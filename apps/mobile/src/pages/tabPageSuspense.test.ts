import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A tab route component must render its `IonPage` synchronously — before calling anything that
 * can suspend.
 *
 * Ionic's `IonRouterOutlet` only transitions a page in once that page registers itself
 * (`StackManager.registerIonPage`). If the route component suspends *before* returning its
 * `IonPage`, there is no page to register: the suspension escapes to the app-level boundary in
 * `App.tsx`, which hides the entire `Main` shell (tabs and outlet included). When it un-hides,
 * every page in the outlet is left marked `ion-page-invisible` and the outlet never recovers —
 * the tab buttons still update the URL and the tab bar highlight, but no page is ever shown
 * again. That reads to a user as "the tab button doesn't work and I'm stuck".
 *
 * The shape that avoids it (see `ShoppingList.tsx`):
 *
 *     const Page = () => (
 *         <IonPage>
 *             <Suspense fallback={<LoadingFallback />}>
 *                 <PageContent />   // every suspending hook lives in here
 *             </Suspense>
 *         </IonPage>
 *     );
 *
 * This is a source-level check on purpose: `vitest.config.ts` deliberately runs these suites in
 * a `node` environment with no jsdom and no Ionic custom elements, so actually rendering the
 * pages is out of scope here.
 */

const SRC = join(__dirname, "..");

/** Directories holding the app's data hooks. */
const HOOK_DIRS = ["db", "hooks", "hooks/refresh", "households", "llm/config"];

const readIfFile = (path: string): string | null => {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
};

/**
 * Collect the names of every exported hook whose body reaches for a suspense query. Derived from
 * the source rather than hard-coded so a newly-added suspending hook is covered automatically.
 */
const collectSuspendingHooks = (): Set<string> => {
    const names = new Set<string>();

    for (const dir of HOOK_DIRS) {
        let entries: string[];
        try {
            entries = readdirSync(join(SRC, dir));
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
            if (entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) continue;

            const source = readIfFile(join(SRC, dir, entry));
            if (source === null) continue;

            // Split on exported hook declarations, then keep the ones whose body suspends. The
            // chunk for a declaration runs up to the next exported declaration.
            const declaration = /export\s+(?:async\s+)?(?:function|const)\s+(use[A-Za-z0-9_]*)/g;
            const matches = [...source.matchAll(declaration)];

            matches.forEach((match, i) => {
                const start = match.index ?? 0;
                const end =
                    i + 1 < matches.length
                        ? (matches[i + 1].index ?? source.length)
                        : source.length;
                const body = source.slice(start, end);
                // Matches useSuspenseQuery / useSuspenseQueries under any import alias, since
                // these files import them as `useSuspenseQuery as useTanstackSuspenseQuery`.
                if (/SuspenseQuer(y|ies)\s*[({]/.test(body)) {
                    names.add(match[1]);
                }
            });
        }
    }

    return names;
};

/** The tab route components wired up in `Main.tsx`, as `[tabHref, pageFile]`. */
const collectTabPages = (): [string, string][] => {
    const main = readFileSync(join(SRC, "components", "Main.tsx"), "utf8");

    const routes = [...main.matchAll(/<Route\s+exact\s+path="([^"]+)"\s+component=\{(\w+)\}/g)];
    expect(routes.length, "expected to find the tab <Route>s in Main.tsx").toBeGreaterThan(0);

    return routes.map(([, path, component]) => {
        const imported = new RegExp(`import\\s+${component}\\s+from\\s+"([^"]+)"`).exec(main);
        expect(
            imported,
            `expected a default import for the ${component} route component`
        ).not.toBeNull();
        const relative = imported![1].replace(/^\.\.\//, "");
        return [path, join(SRC, `${relative}.tsx`)];
    });
};

describe("tab pages render IonPage before suspending", () => {
    const suspendingHooks = collectSuspendingHooks();

    it("finds the suspending hooks to guard against", () => {
        // Sanity-check the scanner itself: if these stop being suspense-based the assertions
        // below would silently pass for the wrong reason.
        expect(suspendingHooks).toContain("usePreference");
        expect(suspendingHooks).toContain("useStores");
    });

    const tabPages = collectTabPages();

    it.each(tabPages)("%s renders IonPage above every suspending hook", (_path, file) => {
        const source = readFileSync(file, "utf8");

        const defaultExport = /export\s+default\s+(\w+)\s*;/.exec(source);
        expect(defaultExport, `${file} should have a named default export`).not.toBeNull();
        const componentName = defaultExport![1];

        const declaration = new RegExp(`const\\s+${componentName}\\s*:\\s*React\\.FC[^=]*=`).exec(
            source
        );
        expect(
            declaration,
            `expected to locate the \`${componentName}\` component declaration in ${file}`
        ).not.toBeNull();

        const component = source.slice(declaration!.index);

        const ionPageAt = component.indexOf("<IonPage");
        expect(ionPageAt, `${componentName} must render an <IonPage>`).toBeGreaterThan(-1);

        const beforeIonPage = component.slice(0, ionPageAt);
        const offenders = [...suspendingHooks].filter((hook) =>
            new RegExp(`\\b${hook}\\s*\\(`).test(beforeIonPage)
        );

        expect(
            offenders,
            `${componentName} calls ${offenders.join(", ")} before rendering <IonPage>. A tab ` +
                `route component that suspends before its IonPage registers permanently breaks ` +
                `Ionic's router outlet (every page ends up ion-page-invisible and tab buttons ` +
                `stop showing pages). Move the data into a child behind a <Suspense> boundary ` +
                `*inside* the <IonPage>, the way ShoppingList.tsx does.`
        ).toEqual([]);
    });
});
