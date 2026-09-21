# Changelog

Todas as mudanças relevantes serão registradas aqui.

O formato segue, de forma simplificada, Keep a Changelog.

## [Unreleased]

- Preparação de segurança, documentação, deploy e release pública.

## [1.0.0] - 2026-09-21

### Added

- autenticação local, sessões e administração;
- Programs, Cohorts, períodos, Subjects, Offerings e Enrollments;
- Hoje, agenda, atividades e páginas de disciplina;
- Google OAuth opcional, Drive/Docs e Classroom read-only;
- armazenamento acadêmico central opcional no Drive;
- Notes privadas e Notes de disciplina;
- templates Google Docs, importação DOCX e geração por categoria;
- Groups, compartilhamento explícito de Notes/Documents e Chat;
- perfis, Visual Tags, onboarding e notificações;
- Projects com versionamento e feature flag;
- favicon discovery seguro e personalização da Home;
- temas claro/escuro e interface TUI-inspired.

### Security

- tokens Google criptografados em repouso;
- cookies HttpOnly e Secure em produção;
- uploads privados e validação de imagens/DOCX/ZIP;
- proteção SSRF para descoberta de ícones;
- autorização server-side para recursos compartilhados;
- scopes Google mínimos para as capacidades atuais.

### Notes

A primeira publicação pública ainda depende da auditoria final e da escolha da licença.
