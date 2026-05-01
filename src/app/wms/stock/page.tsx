import { WmsClient } from "@/components/wms-client";
import {
  getViewerGrantSet,
  viewerHasWmsInventoryLotMutationEdit,
  viewerHasWmsInventoryQtyMutationEdit,
  viewerHasWmsInventorySerialMutationEdit,
  viewerHasWmsSectionMutationEdit,
} from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function WmsStockPage() {
  const access = await getViewerGrantSet();
  const grantSet = access?.grantSet;
  const hasUser = Boolean(access?.user);
  const canEdit = Boolean(hasUser && grantSet && viewerHasWmsSectionMutationEdit(grantSet, "inventory"));
  const inventoryQtyEdit = Boolean(hasUser && grantSet && viewerHasWmsInventoryQtyMutationEdit(grantSet));
  const inventoryLotEdit = Boolean(hasUser && grantSet && viewerHasWmsInventoryLotMutationEdit(grantSet));
  const inventorySerialEdit = Boolean(hasUser && grantSet && viewerHasWmsInventorySerialMutationEdit(grantSet));

  return (
    <WmsClient
      canEdit={canEdit}
      section="stock"
      inventoryQtyEdit={inventoryQtyEdit}
      inventoryLotEdit={inventoryLotEdit}
      inventorySerialEdit={inventorySerialEdit}
    />
  );
}
