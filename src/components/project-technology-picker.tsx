"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useState } from "react";

import {
  projectTechnologies,
  projectTechnologyLabels,
  type ProjectTechnology,
} from "@/lib/project-manifest";

export function ProjectTechnologyPicker({
  initial,
}: {
  initial: ProjectTechnology[];
}) {
  const [selected, setSelected] = useState<ProjectTechnology[]>(initial);
  const [query, setQuery] = useState("");
  const matches = projectTechnologies.filter(
    (technology) =>
      !selected.includes(technology) &&
      projectTechnologyLabels[technology]
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="project-technology-picker">
      <label>
        <UiCopy pt="Tecnologias adicionais" en="Additional technologies" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar tecnologia"
        />
      </label>
      <div
        className="project-technology-chips"
        aria-label="Tecnologias selecionadas"
      >
        {selected.length ? (
          selected.map((technology) => (
            <span key={technology}>
              {projectTechnologyLabels[technology]}
              <button
                type="button"
                aria-label={`Remover ${projectTechnologyLabels[technology]}`}
                onClick={() =>
                  setSelected((current) =>
                    current.filter((item) => item !== technology),
                  )
                }
              >
                ×
              </button>
              <input type="hidden" name="technologies" value={technology} />
            </span>
          ))
        ) : (
          <small>
            <UiCopy pt="Nenhuma selecionada." en="None selected." />
          </small>
        )}
      </div>
      {matches.length ? (
        <div
          className="project-technology-options"
          aria-label="Adicionar tecnologia"
        >
          {matches.map((technology) => (
            <button
              key={technology}
              type="button"
              onClick={() => {
                setSelected((current) => [...current, technology]);
                setQuery("");
              }}
            >
              + {projectTechnologyLabels[technology]}
            </button>
          ))}
        </div>
      ) : query ? (
        <small>
          <UiCopy
            pt="Nenhuma tecnologia encontrada."
            en="No technologies found."
          />
        </small>
      ) : null}
    </div>
  );
}
