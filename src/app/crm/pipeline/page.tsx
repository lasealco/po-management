import { CrmPipelineBoard } from "@/components/crm-pipeline-board";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmPipelinePage() {
  return (
    <CrmGate>
      <CrmPipelineBoard />
    </CrmGate>
  );
}
