# Verificação em duas etapas do administrador

Desde a 3.1.0, cada conta do Admin pode adicionar um código temporário (TOTP) gerado por um aplicativo autenticador. É opcional e vem desligado: as contas existentes continuam entrando só com a senha até que cada administrador ative para a própria conta. A proteção vale apenas para o Admin privado; contas de usuários do App não são afetadas.

Abra **Admin → Minha conta · Segurança**, informe sua senha atual e clique em **Configurar autenticador**. Leia o QR Code ou insira a chave manual em um aplicativo TOTP. Confirme com os seis dígitos. O código muda a cada 30 segundos; mantenha os relógios do servidor e celular sincronizados.

Salve os dez códigos de recuperação quando aparecerem. São exibidos uma vez, armazenados apenas como hashes e cada um funciona uma única vez. O segredo TOTP fica criptografado com a chave da instância. Guarde uma cópia dessa chave separadamente; não compartilhe QR Code nem segredo manual.

Depois da ativação, validar a senha cria somente um desafio temporário. Não há sessão administrativa completa antes do segundo fator. O desafio dura cinco minutos e aceita até cinco tentativas. Um código do mesmo intervalo já utilizado é recusado; espere o próximo código se acabou de ativar ou alterar a proteção. Tentativas incorretas também têm limite por conta de 15 minutos, mesmo criando novos desafios.

Desativar a proteção ou gerar novos códigos exige senha atual e um código válido ainda não usado. As outras sessões administrativas são encerradas. Essas ações e a recuperação operacional ficam na auditoria, sem registrar segredos.

## Perdi o autenticador e os códigos

Um operador autorizado pode recuperar a conta pelo terminal do servidor. Não existe endpoint público de recuperação. Guarde um backup e confira a identidade antes de executar no **contêiner do Admin**:

```sh
docker ps --format '{{.Names}}' | grep openstudyhub-admin
docker exec -it SEU_CONTAINER_ADMIN node dist/admin-mfa-recover.mjs
```

O comando pergunta o login e exige a confirmação explícita `RESET login`. Desativa a proteção daquela conta, encerra todas as suas sessões e registra auditoria. Entre novamente e configure um novo autenticador. Não apague tabelas nem altere migrations antigas.

Em um checkout com o ambiente normal carregado, use `pnpm exec tsx scripts/admin-mfa-recover.ts`. A variável absoluta `OPENSTUDYHUB_V2_DATABASE_PATH` precisa apontar para o banco canônico.
