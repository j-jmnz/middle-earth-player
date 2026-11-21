// The Settings screens (docs/design-system.md, Settings; user decision, 2026-11-21): a first page of categories, each with what it is set to
// now, a search over every setting and the quick setups; a category opens its own page. In an expanded window the categories stay at the
// left and the open category, or the search's results, fill the right. Every change applies at once and is saved by bindTableSettings; the
// page itself reflows when the scale or the theme changes, which is the feedback.
import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "zustand";

import { Column, IconButton, Screen, ScreenScroll, ScreenTitle, SearchField, Section, TwoPane } from "../kit/chrome";
import { goBack } from "../nav/go-back";
import { cardNames } from "../data/card-names";
import { useDatabases } from "../data/databases";
import { EFFECTS } from "../../effects";
import { categoryOf, type CategoryId } from "../../play/chrome/settings-catalog";
import { alwaysCodes, alwaysRows } from "../../play/chrome/settings-words";
import { tableSettings } from "../../ui/table-settings";
import { offerTitle } from "../../ui/update/offer";
import { useUiScale } from "../../ui/ui-scale";
import { useSizeClass } from "../../ui/use-size-class";
import { APP_VERSION } from "../update/offer";
import { useShownOffer } from "./about";
import { CategoryList, changeSettings, QuickSetups, SearchResults } from "./home";
import { CategoryPage } from "./page";

/**
 * A pushed screen with Back beside its title (docs/design-system.md, Navigation). With no `category` it is the first page, whose Back goes
 * to the hub whose gear opened it, or, when `fromTable` is set (route param `from=table`, the table's All settings), to the table. With a
 * `category` it is that category's page, whose Back goes to the first page. `saves` is the web's and the desktop's Saves page (view.canvaskit.tsx).
 */
export function SettingsView({ fromTable = false, category, saves }: { fromTable?: boolean; category?: CategoryId; saves?: ReactNode }) {
  const s = useUiScale();
  const { size } = useSizeClass();
  const router = useRouter();
  const settings = useStore(tableSettings, (state) => state.settings);
  const { catalog } = useDatabases();
  const codes = useMemo(() => alwaysCodes(settings.alwaysUse, EFFECTS), [settings.alwaysUse]);
  const names = useMemo(() => cardNames(catalog, codes), [catalog, codes]);
  const always = alwaysRows(settings.alwaysUse, EFFECTS, (code) => names.get(code));
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<CategoryId>(category ?? "look");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offer = useShownOffer();
  const aboutLine = offer ? offerTitle(offer) : `Version ${APP_VERSION}`;
  const query = search.trim();
  const expanded = size === "expanded";
  const back = category ? "Back to Settings" : fromTable ? "Back to the table" : "Back";
  // A phone or a medium window pushes the category's page; an expanded window opens it at the right.
  const open = (id: CategoryId) => {
    if (expanded) {
      setPicked(id);
      setSearch("");
    } else router.push({ pathname: "/settings/[category]", params: { category: id } });
  };
  // Expanded, the title row starts at the list's edge; otherwise it sits in the page's reading column.
  const header = (title: string) => {
    const row = (
      <View className="flex-row items-center gap-3 pb-1 pt-2">
        <IconButton chevron testID="app-settings-back" label={back} onPress={() => goBack(router, "/settings")} />
        <ScreenTitle>{title}</ScreenTitle>
      </View>
    );
    return expanded ? row : <Column>{row}</Column>;
  };
  const searchField = (
    <View className="mt-1 flex-row">
      <SearchField testID="app-settings-search" value={search} onChangeText={setSearch} placeholder="Search settings" accessibilityLabel="Search settings" accessibilityHint="Finds a setting by its name or what it does" />
    </View>
  );
  const page = (id: CategoryId) => <CategoryPage id={id} settings={settings} always={always} onChange={changeSettings} saves={saves} scrollRef={scroll} />;
  const results = <SearchResults query={query} settings={settings} always={always} onChange={changeSettings} onOpen={open} />;

  if (expanded) {
    // The list and the setups at the left; the picked category, or the search's results, at the right in a reading column.
    return (
      <Screen scene="calm" testID="app-settings">
        {header("Settings")}
        <TwoPane
          kind="list-detail"
          testID="app-settings-columns"
          start={
            <>
              {searchField}
              <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ paddingTop: 12 * s, paddingBottom: 32 * s }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <CategoryList settings={settings} aboutLine={aboutLine} picked={query ? null : picked} onOpen={open} />
                <QuickSetups settings={settings} onChange={changeSettings} />
              </ScrollView>
            </>
          }
          end={
            <ScreenScroll key={query ? "search" : picked} top={8} bottom={32} testID="app-settings-scroll" scrollRef={scroll} max="readable" align="start">
              <Section title={query ? "Found" : categoryOf(picked).title} />
              {query ? results : page(picked)}
            </ScreenScroll>
          }
        />
      </Screen>
    );
  }

  if (category) {
    return (
      <Screen scene="calm" testID="app-settings">
        {header(categoryOf(category).title)}
        <ScreenScroll top={8} bottom={32} testID="app-settings-scroll" scrollRef={scroll} max="readable">
          {page(category)}
        </ScreenScroll>
      </Screen>
    );
  }

  return (
    <Screen scene="calm" testID="app-settings">
      {header("Settings")}
      <ScreenScroll top={4} bottom={32} testID="app-settings-scroll" scrollRef={scroll} max="readable">
        {searchField}
        {query ? (
          results
        ) : (
          <View className="mt-3">
            <CategoryList settings={settings} aboutLine={aboutLine} onOpen={open} />
            <QuickSetups settings={settings} onChange={changeSettings} />
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}
