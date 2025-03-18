import { List, ActionPanel, Action, showToast, Toast, getPreferenceValues, Icon } from "@raycast/api";
import { useState, useEffect } from "react";
import { readdir } from "fs/promises";
import { join } from "path";
import { Preferences } from "./types";
import { format } from "date-fns";

interface Page {
  name: string;
  category: "journal" | "page";
}

const formatDate = (dateStr: string) => {
  try {
    // Handle underscore-separated date format (e.g., 2023_04_28)
    const normalizedDateStr = dateStr.replace(/_/g, '-');
    const [year, month, day] = normalizedDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    const preferences = getPreferenceValues<Preferences>();
    return format(date, preferences.dateFormat || "EEEE, yyyy/MM/dd");
  } catch {
    return dateStr;
  }
};

export default function Command() {
  const [pages, setPages] = useState<Page[]>([]);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | "journal" | "page">("");
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    loadPages();
  }, []);

  async function loadPages() {
    try {
      const subDirs = ["journals", "pages"];
      const allFiles = await Promise.all(
        subDirs.map(async (dir) => {
          const dirPath = join(preferences.logseqPath, dir);
          try {
            const files = await readdir(dirPath);
            return files
              .filter((file) => file.endsWith(".md"))
              .map((file) => ({
                name: file.replace(".md", ""),
                category: {
                  journals: "journal",
                  pages: "page",
                }[dir],
              }));
          } catch {
            return [];
          }
        }),
      );

      const filtered = allFiles.flat().sort((a, b) => {
        if (a.category === "journal") return -1;
        if (b.category === "journal") return 1;
        return a.name.localeCompare(b.name);
      });

      setPages(filtered);
    } catch (error) {
      showToast(Toast.Style.Failure, "Failed to load pages");
    }
  }

  const filteredPages = pages.filter((page) => {
    let effectiveSearchText = searchText.toLowerCase();
    let effectiveCategory = categoryFilter;

    if (effectiveSearchText.startsWith('j ')) {
      effectiveCategory = 'journal';
      effectiveSearchText = effectiveSearchText.slice(2);
    } else if (effectiveSearchText.startsWith('p ')) {
      effectiveCategory = 'page';
      effectiveSearchText = effectiveSearchText.slice(2);
    }

    const matchesSearch = effectiveSearchText === '' || page.name.toLowerCase().includes(effectiveSearchText);
    const matchesCategory = !effectiveCategory || page.category === effectiveCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <List
      searchBarPlaceholder="Search pages..."
      onSearchTextChange={setSearchText}
      onKeyPress={(event) => {
        if (event.key === 'j') {
          setCategoryFilter('journal');
        } else if (event.key === 'p') {
          setCategoryFilter('page');
        }
      }}      searchBarAccessory={
        <List.Dropdown tooltip="Filter by Category" value={categoryFilter} onChange={setCategoryFilter}>
          <List.Dropdown.Item title="All" value="" />
          <List.Dropdown.Item title="Journal" value="journal" />
          <List.Dropdown.Item title="Pages" value="page" />
        </List.Dropdown>
      }
    >
      {filteredPages.map((page, index) => (
        <List.Item
          key={index}
          title={page.name.replace(/___/g, "/")}
          accessories={[
            {
              icon: {
                journal: Icon.Book,
                page: Icon.Document,
              }[page.category],
              text: page.category.charAt(0).toUpperCase() + page.category.slice(1),
            },
          ]}
          actions={
            <ActionPanel>
              {(() => {
                const graphName = encodeURIComponent(preferences.logseqPath.split("/").pop() || "");
                const pageName = page.category === "journal" ? formatDate(page.name) : page.name.replace(/___/g, "/");
                // const encodedPageName = encodeURIComponent(pageName);
                const url = `logseq://graph/${graphName}?page=${pageName}`;
                return <Action.OpenInBrowser key={index} title="Open Page" url={url} />;
              })()}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
