# Exemplos genéricos de modelos

Este diretório distribui referências DOCX neutras e opcionais. Migrations não importam nem ativam esses exemplos; cada instância pode escolher outros modelos.

A importação explícita cria um Google Doc pertencente ao aplicativo, com placeholders e configuração de seções correspondentes. O usuário pode ajustar o estilo no Google Docs. O Doc de origem permanece canônico; o Hub mantém seu ID, configuração do modelo e metadados dos arquivos gerados.

O manifesto `template-manifest.json` descreve os placeholders `{{placeholder}}`. A geração substitui campos conhecidos, deixa valores opcionais ausentes em branco e cria uma cópia sem editar a origem. Para inserir seções em um ponto específico, use `{{document.sections}}`; sem esse marcador, as seções são acrescentadas ao final da cópia.

Arquivos existentes ainda precisam da autorização `drive.file`. Deixar a origem vazia ao criar um modelo permite criar um Doc básico do aplicativo para estilizar depois. Os DOCX e nomes de campos originais permanecem iguais nas duas edições.
