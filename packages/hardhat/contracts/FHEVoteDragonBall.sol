// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEVoteDragonBall
 * @dev Users can vote once for their favorite Dragon Ball character (1-4) using FHE.
 *      Only the user can decrypt and see their vote. Contract doesn't count total votes.
 */
contract FHEVoteDragonBall is SepoliaConfig {
    // Encrypted vote per user
    mapping(address => euint32) private _userVotes;

    // Simple flag to mark if a user has voted
    mapping(address => bool) private _hasVotedFlag;

    /**
     * @notice Cast a vote for your favorite character (1–4).
     * @param choiceEncrypted The encrypted vote (1: Goku, 2: Vegeta, 3: Gohan, 4: Frieza)
     * @param proof Zero-knowledge proof for encrypted input.
     */
    function vote(externalEuint32 choiceEncrypted, bytes calldata proof) external {
        require(!_hasVotedFlag[msg.sender], "Already voted");

        euint32 choice = FHE.fromExternal(choiceEncrypted, proof);
        _userVotes[msg.sender] = choice;
        _hasVotedFlag[msg.sender] = true;

        // Allow the user and contract to decrypt this vote
        FHE.allow(_userVotes[msg.sender], msg.sender);
        FHE.allowThis(_userVotes[msg.sender]);
    }

    /**
     * @notice Check if a user has already voted.
     * @param user The address to check
     */
    function hasVoted(address user) external view returns (bool) {
        return _hasVotedFlag[user];
    }

    /**
     * @notice Get the encrypted vote of a user (only decryptable by user or contract).
     * @param user The address whose vote to retrieve
     * @return Encrypted vote
     */
    function getVote(address user) external view returns (euint32) {
        return _userVotes[user];
    }
}
