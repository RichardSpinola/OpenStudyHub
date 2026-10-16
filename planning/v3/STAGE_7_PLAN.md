# Etapa 7 — escopo planejado

Esta etapa ainda não foi iniciada. Os ajustes de jogos, Foco, Flashcards, som e Chat pedidos após a etapa 6 são uma revisão da etapa 6. A identidade Material/Legacy aprovada continua a base.

## 1. Configurações e navegação

- Revisar todas as seções de Configurações do usuário: conta/perfil, personalização, Google, notificações, ajuda e Sobre/Créditos.
- Separar ações comuns de opções avançadas, alinhar controles e tornar salvamento, erro e retorno explícitos. Evitar links pequenos como única entrada de uma função principal.
- Conferir telas estreitas, baixas e amplas nos dois temas e nas duas posições de navegação. Preservar os fluxos administrativos já aprovados; ajustes ali serão direcionados a inconsistências comprovadas.
- Manter som de jogos dentro de Aparência; não duplicar o controle em cada jogo.

## 2. Aparência opcional

- Adicionar efeito de wallpaper com desfoque no fundo de áreas compatíveis e na barra de navegação, ativável em Personalização.
- Desligado inicialmente; sem imagem usa a superfície normal. Intensidade e alcance precisam manter contraste e legibilidade.
- Respeitar redução de transparência/movimento e oferecer retorno imediato ao visual sólido. Evitar aplicar filtros pesados a cada componente.

## 3. Backup e recuperação

- Backup consistente dos bancos e arquivos locais geridos pela instância, com manifesto de conteúdo e versão. Distinguir links externos de arquivos efetivamente copiados.
- Criptografia e chave de recuperação, exportação sanitizada separada, destino local e integração com Drive conforme a configuração autorizada.
- Agendamento e retenção com estado de falha visível; não declarar sucesso após cópia parcial.
- Restauração guiada em instância de teste, com verificação de integridade, vínculos e recuperação após interrupção. Tutorial simples para o administrador.

## 4. Desempenho e consumo

- Medir RAM e tempo de resposta antes/depois em cenários reproduzíveis, com tarefas pesadas uma por vez.
- Limitar concorrência e cópias em RAM de ZIPs/uploads/downloads, preferindo transferência em fluxo quando suportada.
- Reutilizar conexões de banco, tirar migrações/verificações caras das leituras comuns e reduzir consultas repetidas.
- Cache curto e renovação de tokens Google sem duplicação; reduzir polling e automações repetidas, mantendo reconexão e atualização correta.
- Conferir a base de build/runtime, dependências fixadas e pacote necessário. Otimizações só serão declaradas com medição.

## 5. Diagnóstico e operação

- Saúde real do banco, realtime, armazenamento e integrações; mostrar causa e ação de recuperação compreensíveis.
- Configuração/diagnóstico de notificações push e VAPID para instalação nova.
- Rever inicialização com rede tardia e operação pelo gerenciador/Compose, sem substituir silenciosamente a instalação existente.
- Conferir autorização e limites de login/realtime em ambiente de teste controlado.

## 6. Idioma e teste de uso

- Revisar textos e alternância de idioma, especialmente rótulos misturados, erros e configurações.
- Percurso com contas fictícias como usuário iniciante: campos inválidos, cancelar, tentar de novo, recarregar, revogar acesso, recuperar backup e entender estados desconectados.
- Relatar resultados e limites, com testes dirigidos, conferência visual e um commit da entrega.

## Integração real e etapa 8

O ensaio com Google/Drive real, usando uma instância nova no notebook, depende da confirmação futura já combinada antes de acessar/copiar secrets do servidor. Nenhum secret será buscado enquanto isso. Produção continua pausada.

A etapa 8 continua reservada ao checkpoint integrado: ensaio real dividido em percursos, documentação/distribuição/extensão, revisão de privacidade e preparação de publicação no GitHub. Isso não elimina a possibilidade de novas funcionalidades depois da V3.
