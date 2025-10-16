import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHEVoteDragonBall, FHEVoteDragonBall__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEVoteDragonBall")) as FHEVoteDragonBall__factory;
  const voteContract = (await factory.deploy()) as FHEVoteDragonBall;
  const voteContractAddress = await voteContract.getAddress();

  return { voteContract, voteContractAddress };
}

describe("FHEVoteDragonBall", function () {
  let signers: Signers;
  let voteContract: FHEVoteDragonBall;
  let voteContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ voteContract, voteContractAddress } = await deployFixture());
  });

  // ===== Basic Tests =====
  it("should indicate that users haven't voted initially", async function () {
    expect(await voteContract.hasVoted(signers.alice.address)).to.eq(false);
    expect(await voteContract.hasVoted(signers.bob.address)).to.eq(false);
  });

  it("should allow a user to cast a vote and prevent double voting", async function () {
    const choice = 1; // Goku
    const encryptedChoice = await fhevm
      .createEncryptedInput(voteContractAddress, signers.alice.address)
      .add32(choice)
      .encrypt();

    // Cast vote
    await (
      await voteContract.connect(signers.alice).vote(encryptedChoice.handles[0], encryptedChoice.inputProof)
    ).wait();

    // Check flag
    expect(await voteContract.hasVoted(signers.alice.address)).to.eq(true);

    // Decrypt vote
    const decryptedVote = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await voteContract.getVote(signers.alice.address),
      voteContractAddress,
      signers.alice,
    );
    expect(decryptedVote).to.eq(choice);

    // Attempt to vote again should revert
    const encryptedChoice2 = await fhevm
      .createEncryptedInput(voteContractAddress, signers.alice.address)
      .add32(2)
      .encrypt();

    await expect(
      voteContract.connect(signers.alice).vote(encryptedChoice2.handles[0], encryptedChoice2.inputProof),
    ).to.be.revertedWith("Already voted");
  });

  it("should allow multiple users to vote independently", async function () {
    const aliceChoice = 2; // Vegeta
    const bobChoice = 3; // Gohan

    const aliceEncrypted = await fhevm
      .createEncryptedInput(voteContractAddress, signers.alice.address)
      .add32(aliceChoice)
      .encrypt();

    const bobEncrypted = await fhevm
      .createEncryptedInput(voteContractAddress, signers.bob.address)
      .add32(bobChoice)
      .encrypt();

    // Alice votes
    await (await voteContract.connect(signers.alice).vote(aliceEncrypted.handles[0], aliceEncrypted.inputProof)).wait();
    // Bob votes
    await (await voteContract.connect(signers.bob).vote(bobEncrypted.handles[0], bobEncrypted.inputProof)).wait();

    // Decrypt votes
    const aliceDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await voteContract.getVote(signers.alice.address),
      voteContractAddress,
      signers.alice,
    );
    const bobDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await voteContract.getVote(signers.bob.address),
      voteContractAddress,
      signers.bob,
    );

    expect(aliceDecrypted).to.eq(aliceChoice);
    expect(bobDecrypted).to.eq(bobChoice);

    // Voting flags
    expect(await voteContract.hasVoted(signers.alice.address)).to.eq(true);
    expect(await voteContract.hasVoted(signers.bob.address)).to.eq(true);
  });

  // ===== Extended Tests =====
  it("should return uninitialized vote for users who haven't voted", async function () {
    const encryptedVote = await voteContract.getVote(signers.bob.address);
    expect(encryptedVote).to.eq(ethers.ZeroHash);
  });

  it("should correctly track hasVoted flags for multiple users", async function () {
    const aliceChoice = 1;
    const bobChoice = 4;

    const aliceEncrypted = await fhevm
      .createEncryptedInput(voteContractAddress, signers.alice.address)
      .add32(aliceChoice)
      .encrypt();
    const bobEncrypted = await fhevm
      .createEncryptedInput(voteContractAddress, signers.bob.address)
      .add32(bobChoice)
      .encrypt();

    await (await voteContract.connect(signers.alice).vote(aliceEncrypted.handles[0], aliceEncrypted.inputProof)).wait();

    expect(await voteContract.hasVoted(signers.alice.address)).to.eq(true);
    expect(await voteContract.hasVoted(signers.bob.address)).to.eq(false);

    await (await voteContract.connect(signers.bob).vote(bobEncrypted.handles[0], bobEncrypted.inputProof)).wait();

    expect(await voteContract.hasVoted(signers.alice.address)).to.eq(true);
    expect(await voteContract.hasVoted(signers.bob.address)).to.eq(true);
  });

  it("should allow multiple users to vote consecutively without conflict", async function () {
    const choices = [1, 2, 3]; // simulate 3 users
    const users = [signers.deployer, signers.alice, signers.bob];

    for (let i = 0; i < users.length; i++) {
      const encrypted = await fhevm
        .createEncryptedInput(voteContractAddress, users[i].address)
        .add32(choices[i])
        .encrypt();
      await (await voteContract.connect(users[i]).vote(encrypted.handles[0], encrypted.inputProof)).wait();
    }

    for (let i = 0; i < users.length; i++) {
      expect(await voteContract.hasVoted(users[i].address)).to.eq(true);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        await voteContract.getVote(users[i].address),
        voteContractAddress,
        users[i],
      );
      expect(decrypted).to.eq(choices[i]);
    }
  });

  it("should revert when multiple users attempt to double vote", async function () {
    const encrypted = await fhevm.createEncryptedInput(voteContractAddress, signers.alice.address).add32(1).encrypt();

    await (await voteContract.connect(signers.alice).vote(encrypted.handles[0], encrypted.inputProof)).wait();

    const encrypted2 = await fhevm.createEncryptedInput(voteContractAddress, signers.alice.address).add32(2).encrypt();

    await expect(
      voteContract.connect(signers.alice).vote(encrypted2.handles[0], encrypted2.inputProof),
    ).to.be.revertedWith("Already voted");
  });

  it("should handle invalid vote choices (out of expected range)", async function () {
    const invalidChoice = 5; // out of expected 1-4 range
    const encryptedChoice = await fhevm
      .createEncryptedInput(voteContractAddress, signers.bob.address)
      .add32(invalidChoice)
      .encrypt();

    await (await voteContract.connect(signers.bob).vote(encryptedChoice.handles[0], encryptedChoice.inputProof)).wait();

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await voteContract.getVote(signers.bob.address),
      voteContractAddress,
      signers.bob,
    );

    expect(decrypted).to.eq(invalidChoice);
  });
});
