"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Icon from "@/components/Icon/Icon";
import styles from "./Modal.module.css";

export default function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="modal-title">
      <div className={styles.head}>
        <h2 id="modal-title" className={styles.title}>{title}</h2>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
