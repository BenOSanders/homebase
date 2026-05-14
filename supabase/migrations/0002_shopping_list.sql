-- Shopping list items
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name             text NOT NULL,
  quantity         text,
  category         text,
  checked          boolean NOT NULL DEFAULT false,
  added_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shopping_list_items_household_id_idx ON shopping_list_items(household_id);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can manage shopping list items"
  ON shopping_list_items FOR ALL
  USING  (household_id = my_household_id())
  WITH CHECK (household_id = my_household_id());
