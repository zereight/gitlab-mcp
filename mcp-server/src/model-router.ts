import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface ModelRecommendation {
  recommended_model: string;
  tier: string;
  reason: string;
  alternatives: string[];
}

const COMPLEXITY_THRESHOLDS = {
  high: {
    file_count: 10,
    description_length: 500,
    keywords: [
      "architect", "design", "refactor", "migrate", "security",
      "performance", "optimize", "complex", "critical", "system",
    ],
  },
  medium: {
    file_count: 5,
    description_length: 200,
    keywords: [
      "implement", "add", "update", "feature", "component",
      "module", "service", "test", "debug",
    ],
  },
};

function assessComplexity(
  task: string,
  file_count?: number
): { tier: "high" | "medium" | "low"; score: number; factors: string[] } {
  let score = 0;
  const factors: string[] = [];
  const taskLower = task.toLowerCase();

  // Check high-complexity keywords
  for (const kw of COMPLEXITY_THRESHOLDS.high.keywords) {
    if (taskLower.includes(kw)) {
      score += 3;
      factors.push(`high-complexity keyword: "${kw}"`);
    }
  }

  // Check medium-complexity keywords
  for (const kw of COMPLEXITY_THRESHOLDS.medium.keywords) {
    if (taskLower.includes(kw)) {
      score += 1;
      factors.push(`medium-complexity keyword: "${kw}"`);
    }
  }

  // File count factor
  if (file_count !== undefined) {
    if (file_count >= COMPLEXITY_THRESHOLDS.high.file_count) {
      score += 5;
      factors.push(`high file count: ${file_count}`);
    } else if (file_count >= COMPLEXITY_THRESHOLDS.medium.file_count) {
      score += 2;
      factors.push(`moderate file count: ${file_count}`);
    }
  }

  // Description length factor
  if (task.length >= COMPLEXITY_THRESHOLDS.high.description_length) {
    score += 2;
    factors.push("long task description");
  }

  const tier = score >= 8 ? "high" : score >= 3 ? "medium" : "low";
  return { tier, score, factors };
}

function recommend(tier: "high" | "medium" | "low"): ModelRecommendation {
  switch (tier) {
    case "high":
      return {
        recommended_model: "claude-sonnet-4.6",
        tier: "HIGH",
        reason: "Complex task requiring deep reasoning and architecture decisions",
        alternatives: ["gpt-4.1"],
      };
    case "medium":
      return {
        recommended_model: "gpt-4.1",
        tier: "MEDIUM",
        reason: "Standard implementation task with moderate complexity",
        alternatives: ["claude-sonnet-4.6"],
      };
    case "low":
      return {
        recommended_model: "gpt-4.1-mini",
        tier: "LOW",
        reason: "Simple task suitable for fast, lightweight model",
        alternatives: ["gpt-4.1"],
      };
  }
}

export function registerModelRouter(server: McpServer): void {
  server.tool(
    "omg_select_model",
    "Recommend the best model for a task based on complexity analysis. Maps OMC model tiers (HIGH/MEDIUM/LOW) to available VS Code Copilot models.",
    {
      task: z.string().describe("Description of the task to route"),
      file_count: z
        .number()
        .optional()
        .describe("Number of files involved in the task"),
      agent_type: z
        .string()
        .optional()
        .describe("The agent type that will execute (e.g., architect, executor)"),
    },
    async ({ task, file_count, agent_type }) => {
      const complexity = assessComplexity(task, file_count);

      // Agent type overrides: some agents always need high-tier models
      const highTierAgents = ["architect", "critic", "analyst", "planner"];
      const lowTierAgents = ["writer", "git-master", "code-simplifier", "explore"];

      let recommendation: ModelRecommendation;

      if (agent_type && highTierAgents.includes(agent_type)) {
        recommendation = recommend("high");
        recommendation.reason = `Agent type "${agent_type}" requires high-tier model for quality reasoning`;
      } else if (agent_type && lowTierAgents.includes(agent_type)) {
        recommendation = recommend("low");
        recommendation.reason = `Agent type "${agent_type}" works well with lightweight model`;
      } else {
        recommendation = recommend(complexity.tier);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...recommendation,
              complexity: {
                tier: complexity.tier,
                score: complexity.score,
                factors: complexity.factors,
              },
            }),
          },
        ],
      };
    }
  );
}
