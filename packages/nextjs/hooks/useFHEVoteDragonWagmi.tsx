"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEVoteDragonWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: fheVoteDragon } = useDeployedContractInfo({
    contractName: "FHEVoteDragonBall",
    chainId: allowedChainId,
  });

  type FHEVoteDragonInfo = Contract<"FHEVoteDragonBall"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const hasContract = Boolean(fheVoteDragon?.address && fheVoteDragon?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(fheVoteDragon!.address, (fheVoteDragon as FHEVoteDragonInfo).abi, providerOrSigner);
  };

  const {
    data: myVoteHandle,
    refetch: refreshMyVoteHandle,
    isFetching: isRefreshing,
  } = useReadContract({
    address: hasContract ? (fheVoteDragon!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((fheVoteDragon as FHEVoteDragonInfo).abi as any) : undefined,
    functionName: "getVote" as const,
    args: [accounts ? accounts[0] : ''],
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const voteHandle = useMemo(() => (myVoteHandle as string | undefined) ?? undefined, [myVoteHandle]);

  const hasVoted = useMemo(() => {
    if (!voteHandle) return false;
    if (voteHandle === ethers.ZeroHash || voteHandle === "0x" || voteHandle === "0x0") return false;
    return true;
  }, [voteHandle]);

  const requests = useMemo(() => {
    if (!hasContract || !voteHandle || voteHandle === ethers.ZeroHash) return undefined;
    return [{ handle: voteHandle, contractAddress: fheVoteDragon!.address }] as const;
  }, [hasContract, fheVoteDragon?.address, voteHandle]);

  const {
    canDecrypt,
    decrypt,
    isDecrypting,
    message: decMsg,
    results,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  const clearVote = useMemo(() => {
    if (!voteHandle) return undefined;
    if (voteHandle === ethers.ZeroHash) return { handle: voteHandle, clear: BigInt(0) } as const;
    const clear = results[voteHandle];
    if (typeof clear === "undefined") return undefined;
    return { handle: voteHandle, clear } as const;
  }, [voteHandle, results]);

  const isDecrypted = useMemo(() => {
    if (!voteHandle) return false;
    const val = results?.[voteHandle];
    return typeof val !== "undefined" && BigInt(val) !== BigInt(0);
  }, [voteHandle, results]);

  const decryptMyVote = decrypt

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: fheVoteDragon?.address,
  });

  const canVote = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing && !hasVoted),
    [hasContract, instance, hasSigner, isProcessing, hasVoted],
  );

  const getEncryptionMethodFor = (functionName: "vote") => {
    const functionAbi = fheVoteDragon?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi) {
      return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` };
    }
    if (!functionAbi.inputs || functionAbi.inputs.length === 0) {
      return { method: undefined as string | undefined, error: `No inputs found for ${functionName}` };
    }
    const firstInput = functionAbi.inputs[0]!;
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined };
  };

  const vote = useCallback(
    async (candidateId: number) => {
      if (isProcessing || !canVote || candidateId <= 0) return;
      setIsProcessing(true);
      setMessage(`Starting vote(${candidateId})...`);
      try {
        const { method, error } = getEncryptionMethodFor("vote");
        if (!method) return setMessage(error ?? "Encryption method not found");
        setMessage(`Encrypting with ${method}...`);
        const enc = await encryptWith(builder => {
          (builder as any)[method](candidateId);
        });
        if (!enc) return setMessage("Encryption failed");
        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract info or signer not available");
        const params = buildParamsFromAbi(enc, [...fheVoteDragon!.abi] as any[], "vote");
        const tx = await writeContract.vote(...params, {
          gasLimit: 300_000,
        });
        setMessage("Waiting for transaction...");
        await tx.wait();
        setMessage(`Vote(${candidateId}) completed!`);
        await refreshMyVoteHandle();
      } catch (e) {
        setMessage(`vote() failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canVote, encryptWith, getContract, refreshMyVoteHandle, fheVoteDragon?.abi],
  );

  useEffect(() => {
    setMessage("");
  }, [accounts, chainId]);

  return {
    contractAddress: fheVoteDragon?.address,
    canDecrypt,
    canVote,
    decryptMyVote,
    vote,
    refreshMyVoteHandle,
    isDecrypted,
    message,
    clear: clearVote?.clear,
    handle: voteHandle,
    isDecrypting,
    isRefreshing,
    isProcessing,
    hasVoted,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
