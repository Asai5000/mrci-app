import { getPmisDrugs } from "@/actions/pimsDb";
import PimsDbClient from "./PimsDbClient";

export default async function PimsDbPage() {
  const drugs = await getPmisDrugs();
  return <PimsDbClient initialData={drugs} />;
}
