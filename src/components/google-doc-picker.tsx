"use client";

import { useState } from "react";

type PickerBuilder = {
  addView(view: unknown): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setCallback(callback: (data: Record<string, unknown>) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
};

type DocsView = {
  setMimeTypes(mimeTypes: string): DocsView;
  setSelectFolderEnabled(enabled: boolean): DocsView;
};

type PickerApi = {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId: string) => DocsView;
  ViewId: { DOCS: string };
  Action: { PICKED: string };
  Response: { ACTION: string; DOCUMENTS: string };
  Document: { ID: string };
};

declare global {
  interface Window {
    gapi?: {
      load(
        module: string,
        options: { callback: () => void; onerror: () => void },
      ): void;
    };
    google?: { picker?: PickerApi };
  }
}

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

export function GoogleDocPicker({
  configured,
  inputId,
}: {
  configured: boolean;
  inputId: string;
}) {
  const [status, setStatus] = useState("");

  async function openPicker() {
    setStatus("Abrindo Drive…");
    const response = await fetch("/api/google/picker-token", {
      cache: "no-store",
    });
    if (!response.ok) {
      setStatus("Picker indisponível.");
      return;
    }
    const config = (await response.json()) as {
      accessToken: string;
      apiKey: string;
      appId: string;
    };
    const show = () => {
      const picker = window.google?.picker;
      if (!picker) {
        setStatus("Picker indisponível.");
        return;
      }
      const view = new picker.DocsView(picker.ViewId.DOCS)
        .setMimeTypes(GOOGLE_DOC_MIME)
        .setSelectFolderEnabled(false);
      new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(config.accessToken)
        .setDeveloperKey(config.apiKey)
        .setAppId(config.appId)
        .setCallback((data) => {
          if (data[picker.Response.ACTION] !== picker.Action.PICKED) return;
          const documents = data[picker.Response.DOCUMENTS];
          const first = Array.isArray(documents) ? documents[0] : null;
          const fileId =
            first && typeof first === "object"
              ? (first as Record<string, unknown>)[picker.Document.ID]
              : null;
          if (typeof fileId !== "string") return;
          const input = document.getElementById(inputId);
          if (input instanceof HTMLInputElement) {
            input.value = fileId;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            setStatus("Google Doc selecionado.");
          }
        })
        .build()
        .setVisible(true);
    };
    if (!window.gapi) {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = () =>
        window.gapi?.load("picker", {
          callback: show,
          onerror: () => setStatus("Picker indisponível."),
        });
      script.onerror = () => setStatus("Picker indisponível.");
      document.head.append(script);
    } else {
      window.gapi.load("picker", {
        callback: show,
        onerror: () => setStatus("Picker indisponível."),
      });
    }
  }

  return configured ? (
    <div>
      <button type="button" onClick={() => void openPicker()}>
        Escolher no Drive
      </button>
      {status ? <span role="status">{status}</span> : null}
    </div>
  ) : (
    <p className="panel-help">
      Google Picker não configurado. Importe DOCX ou use um Google Doc já
      autorizado.
    </p>
  );
}
