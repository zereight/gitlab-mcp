import { z } from "zod";
import { ProjectParamsSchema } from "./base.js";

// GraphQL User schema for vulnerabilities
export const GitLabGraphQLUserSchema = z.object({
  id: z.string().describe("GraphQL ID of the user"),
  username: z.string().describe("Username of the user"),
}).describe("User information from GraphQL");

// GraphQL Project schema for vulnerabilities  
export const GitLabGraphQLProjectSchema = z.object({
  id: z.string().describe("GraphQL ID of the project"),
  name: z.string().describe("Project name"),
  fullPath: z.string().describe("Full path of the project"),
}).describe("Project information from GraphQL");

// Vulnerability dependency package schema
export const GitLabGraphQLVulnerabilityDependencyPackageSchema = z.object({
  name: z.string().describe("Package name"),
}).describe("Vulnerable package information");

// Vulnerability dependency schema
export const GitLabGraphQLVulnerabilityDependencySchema = z.object({
  package: GitLabGraphQLVulnerabilityDependencyPackageSchema.describe("Package information"),
  version: z.string().describe("Package version"),
}).describe("Vulnerable dependency information");

// Vulnerability location schema with enhanced location data
export const GitLabGraphQLVulnerabilityLocationSchema = z.object({
  file: z.string().optional().describe("File path where vulnerability was found"),
  startLine: z.number().optional().describe("Starting line number of the vulnerability"),
  endLine: z.number().optional().describe("Ending line number of the vulnerability"),
  dependency: GitLabGraphQLVulnerabilityDependencySchema.optional().describe("Dependency information for dependency scanning"),
  image: z.string().optional().describe("Container image for container scanning"),
  operatingSystem: z.string().optional().describe("Operating system for container scanning"),
}).describe("Location information for the vulnerability");

// Vulnerability identifier schema
export const GitLabGraphQLVulnerabilityIdentifierSchema = z.object({
  name: z.string().describe("Name of the identifier"),
  externalType: z.string().describe("External type of the identifier (e.g., cve, cwe)"),
  externalId: z.string().describe("External ID of the identifier"),
  url: z.string().optional().describe("URL for more information about the identifier"),
}).describe("Vulnerability identifier information");

// Vulnerability scanner schema
export const GitLabGraphQLVulnerabilityScannerSchema = z.object({
  id: z.string().describe("Scanner ID"),
  name: z.string().describe("Scanner name"),
  vendor: z.string().optional().describe("Scanner vendor"),
}).describe("Vulnerability scanner information");

// Main GraphQL vulnerability schema with enhanced data
export const GitLabGraphQLVulnerabilitySchema = z.object({
  title: z.string().describe("Title of the vulnerability"),
  description: z.string().nullable().describe("Description of the vulnerability"),
  state: z.string().describe("State of the vulnerability (DETECTED, CONFIRMED, RESOLVED, etc.)"),
  severity: z.string().describe("Severity level of the vulnerability"),
  reportType: z.string().describe("Type of security report"),
  project: GitLabGraphQLProjectSchema.describe("Project where the vulnerability was found"),
  detectedAt: z.string().nullable().describe("Date when the vulnerability was detected"),
  confirmedAt: z.string().nullable().describe("Date when the vulnerability was confirmed"),
  resolvedAt: z.string().nullable().describe("Date when the vulnerability was resolved"),
  resolvedBy: GitLabGraphQLUserSchema.nullable().describe("User who resolved the vulnerability"),
  // Enhanced fields for location and solution information
  location: GitLabGraphQLVulnerabilityLocationSchema.nullable().describe("Location metadata for the vulnerability"),
  solution: z.string().nullable().describe("Recommended solution for the vulnerability"),
  identifiers: z.array(GitLabGraphQLVulnerabilityIdentifierSchema).describe("Identifiers of the vulnerability (CVE, CWE, etc.)"),
  scanner: GitLabGraphQLVulnerabilityScannerSchema.nullable().describe("Scanner metadata for the vulnerability"),
  primaryIdentifier: GitLabGraphQLVulnerabilityIdentifierSchema.nullable().describe("Primary identifier of the vulnerability"),
}).describe("Vulnerability details from GraphQL API");

// Input schema for getting vulnerabilities by IDs
export const GetVulnerabilitiesByIdsSchema = ProjectParamsSchema.extend({
  vulnerability_ids: z.array(z.string()).describe("Array of vulnerability IDs (numeric parts only, without gid prefix)"),
}).describe("Parameters for fetching multiple vulnerabilities by IDs using GraphQL");

// Types
export type GitLabGraphQLUser = z.infer<typeof GitLabGraphQLUserSchema>;
export type GitLabGraphQLProject = z.infer<typeof GitLabGraphQLProjectSchema>;
export type GitLabGraphQLVulnerabilityDependencyPackage = z.infer<typeof GitLabGraphQLVulnerabilityDependencyPackageSchema>;
export type GitLabGraphQLVulnerabilityDependency = z.infer<typeof GitLabGraphQLVulnerabilityDependencySchema>;
export type GitLabGraphQLVulnerabilityLocation = z.infer<typeof GitLabGraphQLVulnerabilityLocationSchema>;
export type GitLabGraphQLVulnerabilityIdentifier = z.infer<typeof GitLabGraphQLVulnerabilityIdentifierSchema>;
export type GitLabGraphQLVulnerabilityScanner = z.infer<typeof GitLabGraphQLVulnerabilityScannerSchema>;
export type GitLabGraphQLVulnerability = z.infer<typeof GitLabGraphQLVulnerabilitySchema>;
export type GetVulnerabilitiesByIdsOptions = z.infer<typeof GetVulnerabilitiesByIdsSchema>; 