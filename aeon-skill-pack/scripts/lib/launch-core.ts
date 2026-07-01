import { decodeEventLog } from "viem";
import { hashConfig } from "./config-hash";
import { FACTORY_ABI } from "./contracts";
import type { LaunchInputs } from "./inputs";

export interface LaunchArgs {
  name: string;
  symbol: string;
  avatarURI: string;
  configHash: `0x${string}`;
  seedWei: bigint;
}

export function buildLaunchArgs(inputs: LaunchInputs): LaunchArgs {
  return {
    name: inputs.name,
    symbol: inputs.symbol,
    avatarURI: inputs.avatarURI,
    configHash: hashConfig(inputs.config),
    seedWei: inputs.seedWei,
  };
}

export interface AgentCreated {
  agentId: bigint;
  token: `0x${string}`;
  sale: `0x${string}`;
}

type RawLog = { address: string; topics: `0x${string}`[]; data: `0x${string}` };

export function parseAgentCreated(logs: readonly RawLog[]): AgentCreated {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: FACTORY_ABI,
        topics: log.topics,
        data: log.data,
      });
      if (decoded.eventName === "AgentCreated") {
        const a = decoded.args as unknown as { agentId: bigint; token: `0x${string}`; sale: `0x${string}` };
        return { agentId: a.agentId, token: a.token, sale: a.sale };
      }
    } catch {
      // not this event; keep scanning
    }
  }
  throw new Error("AETHREE_LAUNCH_ERROR — AgentCreated not found in receipt logs");
}
