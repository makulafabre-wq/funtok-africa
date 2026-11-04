import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    const key = "funtok:chunk-reload";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    event.preventDefault();
    window.location.reload();
  });
  window.setTimeout(() => sessionStorage.removeItem("funtok:chunk-reload"), 10000);
}
