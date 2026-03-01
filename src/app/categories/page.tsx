"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureHouseholdForCurrentUser } from "@/lib/household";

type Category = {
  id: string;
  group_name: string;
  name: string;
};

type GroupName = {
  id: string;
  name: string;
};

export default function CategoriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groupNames, setGroupNames] = useState<GroupName[]>([]);
  const [groupName, setGroupName] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    const load = async () => {
      const { user, householdId: hhId } = await ensureHouseholdForCurrentUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      if (!hhId) {
        console.error("Could not ensure household for user");
        router.replace("/settings");
        return;
      }

      setHouseholdId(hhId);

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("usage_categories")
        .select("id, group_name, name")
        .eq("household_id", hhId)
        .order("group_name", { ascending: true })
        .order("name", { ascending: true });

      if (categoriesError) {
        console.error("Error loading categories", categoriesError.message);
      } else if (categoriesData) {
        setCategories(categoriesData as Category[]);
        
        // Extract unique group names from categories
        const uniqueGroups = Array.from(
          new Map(
            (categoriesData as Category[])
              .map((cat) => [cat.group_name, cat.group_name])
          ).values()
        ).sort();

        setGroupNames(
          uniqueGroups.map((name, idx) => ({
            id: name.toLowerCase().replace(/\s+/g, "-"),
            name,
          }))
        );

        if (uniqueGroups.length > 0) {
          setGroupName(uniqueGroups[0]);
        }
      }

      setLoading(false);
    };

    void load();
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!householdId || !groupName) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("usage_categories")
      .insert({
        household_id: householdId,
        group_name: groupName,
        name,
      })
      .select("id, group_name, name")
      .single();
    setSaving(false);

    if (error || !data) {
      console.error("Error inserting category", error?.message);
      return;
    }

    setCategories((prev) =>
      [...prev, data as Category].sort((a, b) =>
        a.group_name === b.group_name
          ? a.name.localeCompare(b.name)
          : a.group_name.localeCompare(b.group_name),
      ),
    );
    setName("");
  };

  const onSubmitGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!householdId || !newGroupName.trim()) return;

    setSavingGroup(true);
    
    // Create a placeholder category to establish the group
    const { data, error } = await supabase
      .from("usage_categories")
      .insert({
        household_id: householdId,
        name: `${newGroupName} (group)`,
        group_name: newGroupName,
      })
      .select("id, group_name, name")
      .single();
    
    setSavingGroup(false);

    if (error || !data) {
      console.error("Error creating group", error?.message);
      return;
    }

    // Add the new group to our list
    setGroupNames((prev) => {
      const groupExists = prev.some((g) => g.name === newGroupName);
      if (groupExists) return prev;
      
      const newList = [...prev, { id: newGroupName.toLowerCase().replace(/\s+/g, "-"), name: newGroupName }];
      return newList.sort((a, b) => a.name.localeCompare(b.name));
    });

    setGroupName(newGroupName);
    setNewGroupName("");
  };

  if (loading) {
    return (
      <div className="flex w-full max-w-3xl items-center justify-center rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Loading categories…</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 md:flex-row">
      <section className="w-full rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 md:w-5/12">
        <h1 className="text-sm font-semibold text-slate-900">
          Manage categories
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Add custom groups and categories for your usages.
        </p>
        
        {/* Manage Groups Section */}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h2 className="text-xs font-semibold text-slate-900">Manage groups</h2>
          <form onSubmit={onSubmitGroup} className="mt-3 space-y-2">
            <div className="space-y-1.5">
              <label
                htmlFor="newGroup"
                className="text-xs font-medium text-slate-700"
              >
                New group name
              </label>
              <input
                id="newGroup"
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
                placeholder="Home, Food, Education…"
              />
            </div>
            <button
              type="submit"
              disabled={savingGroup || !newGroupName.trim()}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingGroup ? "Adding…" : "Add group"}
            </button>
          </form>
        </div>

        {/* Add Category Section */}
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="group"
              className="text-xs font-medium text-slate-700"
            >
              Select group
            </label>
            <select
              id="group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
            >
              <option value="">-- Choose a group --</option>
              {groupNames.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="text-xs font-medium text-slate-700"
            >
              Category name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              placeholder="Groceries, Electric bill, Party…"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !groupName}
            className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add category"}
          </button>
        </form>
      </section>
      <section className="w-full rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 md:w-7/12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            All categories
          </h2>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-slate-500">
            No categories yet. Use the form on the left to add some.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left">Group</th>
                  <th className="px-2 py-1 text-left">Category</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr
                    key={c.id}
                    className="rounded-xl bg-slate-50 text-slate-900"
                  >
                    <td className="px-2 py-2 text-xs">{c.group_name}</td>
                    <td className="px-2 py-2 text-xs">{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

