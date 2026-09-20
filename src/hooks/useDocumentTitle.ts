import { useEffect } from "react";
import { PRODUCT_NAME } from "../constants";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${PRODUCT_NAME}` : PRODUCT_NAME;
  }, [title]);
}
