# ChatGPT Manual Evaluation — Spike 1A

**Status:** PENDING MANUAL EXECUTION

## Preconditions

1. Run `npm run seed` and retain the printed Project ID.
2. Run `npm start`.
3. Expose `/mcp` through an approved private development connection such as
   Secure MCP Tunnel.
4. Confirm ChatGPT Developer mode is available and add the Workspace MCP
   connection.

## Conversation A

1. Ask ChatGPT to check whether the Personal AI Workspace is available.
   Expected tool: `workspace_ping`.
2. Ask ChatGPT to read the seeded Project by ID.
   Expected tool: `workspace_get_project`.
   Expected state: `APPLIED`, version 1.
3. Ask ChatGPT to record a test recruiter observation using a stable synthetic
   provider/external ID.
   Expected tool: `workspace_record_observation`.
   Expected result: Project state unchanged.
4. Ask ChatGPT to propose `APPLIED -> RECRUITER_CONTACT` using that Resource as
   evidence.
   Expected tool: `workspace_propose_transition`.
   Expected result: `PROPOSED`; Project state remains `APPLIED`.
5. Do not confirm admission yet. Verify ChatGPT does not call
   `workspace_admit_transition` on its own.
6. Explicitly tell ChatGPT to admit the proposed transition.
   Expected tool: `workspace_admit_transition` with `userConfirmed=true` and a
   short authority reference.
   Expected result: `RECRUITER_CONTACT`, version 2, one
   `RESPOND_TO_RECRUITER` Task.

## Conversation B

Start a separate new ChatGPT conversation without copying Conversation A.

1. Enable the same Workspace connection.
2. Ask for the seeded Project by ID.
3. Verify the result is `RECRUITER_CONTACT`, version 2, and includes the same
   Resource, admitted transition, and derived Task.

## Evidence to capture

- ChatGPT account/workspace type and Developer mode availability
- connection method and endpoint/tunnel ID
- conversation identifiers
- prompts, selected tools, arguments, results, and confirmation behavior
- Project ID, lifecycle state/version, Resource ID, Transition ID, and Task ID
- any retries or unexpected tool selection

Do not classify ChatGPT connectivity or cross-conversation continuity as
SUPPORTED until this evidence is captured.
