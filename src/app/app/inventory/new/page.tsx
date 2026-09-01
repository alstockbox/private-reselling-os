import { ItemForm } from "@/components/forms/item-form";
import { createItem } from "@/lib/reseller/db";

export default function NewItemPage() {
  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="display mb-4 text-4xl font-black">Nytt plagg</h1>
      <ItemForm action={createItem} />
    </main>
  );
}
