"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useFHEVoteDragonWagmi } from "~~/hooks/useFHEVoteDragonWagmi";
import ClipLoader from "react-spinners/ClipLoader";

const CHARACTERS = [
  { id: 1, name: "Goku", image: "/goku.jpg" },
  { id: 2, name: "Vegeta", image: "/vegeta.jpg" },
  { id: 3, name: "Gohan", image: "/gohan.jpg" },
  { id: 4, name: "Frieza", image: "/frieza.jpg" },
];

export const FHEVoteDragonBall = () => {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const provider = useMemo(() => (typeof window !== "undefined" ? (window as any).ethereum : undefined), []);
  const initialMockChains = { 11155111: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` };
  const { instance: fhevmInstance } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });
  const voteDragon = useFHEVoteDragonWagmi({ instance: fhevmInstance, initialMockChains });
  const [flareStates, setFlareStates] = useState(CHARACTERS.map(() => false));

  async function handleVote(index: number, id: number) {
    await voteDragon.vote(id);
  }

  function getCharacterName(id: number) {
    switch (id) {
      case 1:
        return "Goku";
      case 2:
        return "Vegeta";
      case 3:
        return "Gohan";
      case 4:
        return "Frieza";
      default:
        return "Unknown";
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-gray-900 text-center flex items-center" style={{ height: 'calc(100vh - 60px)' }}>
        <div className="bg-white border shadow-xl rounded-xl p-10">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-3">Wallet not connected</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to vote.</p>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-gray-900">
      {voteDragon.isProcessing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50 mb-0">
          <ClipLoader color="#36d7b7" size={40} />
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🐉 FHE Dragon Ball Voting</h1>
        <p className="text-gray-600">Vote privately for your favorite Dragon Ball character!</p>
      </div>

      <div className="bg-[#f4f4f4] p-6 rounded-2xl shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">🗳️ Voting Panel</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {CHARACTERS.map((c, i) => (
            <motion.button
              key={c.id}
              disabled={!voteDragon.canVote || voteDragon.isProcessing}
              onClick={() => handleVote(i, c.id)}
              whileHover={{
                scale: 1.08,
                boxShadow: "0 0 25px rgba(255, 210, 8, 0.8)",
              }}
              whileTap={{ scale: 0.95 }}
              className="relative flex flex-col items-center justify-center p-4 rounded-xl
                           bg-[#FFD208] text-[#2D2D2D] font-semibold shadow-md
                           transition-all duration-200 cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <motion.img
                src={c.image}
                alt={c.name}
                className="w-28 h-28 object-cover rounded-full border-4 border-white shadow-md mb-2"
                animate={{
                  boxShadow: [
                    "0 0 0px rgba(255,255,255,0)",
                    "0 0 20px rgba(255,210,8,0.7)",
                    "0 0 0px rgba(255,255,255,0)",
                  ],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: "easeInOut",
                }}
              />
              <AnimatePresence>
                {flareStates[i] && (
                  <motion.div
                    initial={{ opacity: 1, scale: 0 }}
                    animate={{ opacity: 0, scale: 2 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute inset-0 rounded-xl bg-yellow-400 blur-xl"
                    style={{ zIndex: -1 }}
                  />
                )}
              </AnimatePresence>
              <span className="text-lg font-bold">{c.name}</span>
            </motion.button>
          ))}
        </div>

        {voteDragon.hasVoted && (
          <div className="text-center text-lg font-medium text-green-800 mt-4">✅ You have already voted!</div>
        )}
      </div>

      <div className="bg-[#f4f4f4] p-6 rounded-2xl shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">🔐 My Encrypted Vote</h3>
        {printProperty("Vote Handle", voteDragon.handle !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? voteDragon.handle : "No handle yet",)}
        {printProperty("Decrypted Value", voteDragon.isDecrypted ? String(voteDragon.clear) : "Not decrypted yet")}
        {printProperty("Voted Character", voteDragon.isDecrypted ? getCharacterName(Number(voteDragon.clear)) : "Not decrypted yet",)}
        <button
          disabled={!voteDragon.canDecrypt}
          onClick={voteDragon.decryptMyVote}
          className={`inline-flex items-center justify-center px-6 py-3 rounded-lg mt-4 font-semibold shadow-md
                      ${voteDragon.isDecrypted ? "bg-[#A38025] text-white hover:bg-[#8F6E1E]" : "bg-black text-white hover:bg-gray-800"}
                      transition-transform duration-200 hover:scale-105
                      disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {voteDragon.canDecrypt ? "🔓 Decrypt My Vote" : voteDragon.isDecrypting ? "⏳ Decrypting..." : "❌ Nothing to decrypt"}
        </button>
      </div>

      {voteDragon.message && (
        <div className="bg-[#f4f4f4] p-6 rounded-2xl shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">💬 Message</h3>
          <div className="border bg-white border-gray-200 p-4 rounded-md">
            <p className="text-gray-800">{voteDragon.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

function printProperty(name: string, value: unknown) {
  let val =
    typeof value === "boolean"
      ? value
        ? "✓ true"
        : "✗ false"
      : typeof value === "string" || typeof value === "number"
        ? String(value)
        : JSON.stringify(value ?? "undefined");

  return (
    <div className="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 rounded-md mb-2">
      <span className="font-medium text-gray-800">{name}</span>
      <span
        className={`font-mono text-sm px-2 py-1 rounded ${val.includes("true")
          ? "text-green-800 bg-green-100"
          : val.includes("false")
            ? "text-red-800 bg-red-100"
            : "text-gray-900 bg-gray-100"
          }`}
      >
        {val}
      </span>
    </div>
  );
}
