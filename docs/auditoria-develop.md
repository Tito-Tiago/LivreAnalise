# Auditoria da branch develop

**20 de novembro de 2026 · LivreAnalise 0.8.0.** A auditoria cobre o conteúdo de `6a72c78`, idêntico ao da mesclagem local `380e2be`. Foram revisados os fluxos de projeto e checkpoints, edição de texto e codificação, notas e memos, importação e exportação, transcrição, acessibilidade, desempenho e distribuição.

- **P1** — risco de perda ou alteração silenciosa do material de análise.
- **P2** — falha de fluxo, integridade, acessibilidade ou desempenho em um cenário identificado.
- **P3** — melhoria de manutenção, cobertura ou documentação.
- **Reproduzido** indica um resultado observado com dados descartáveis. **Inspeção** indica uma conclusão do código e inclui as condições que a acionam. **Medido** indica um tempo de processamento em uma máquina.

## P1 · Integridade do projeto

### LA-01 · Renomear um projeto em uso pode separar dados confirmados do arquivo

**Reproduzido em Linux, no nível do SQLite e do sistema de arquivos.** A renomeação só detecta o caminho ativo da instância atual, move o `.liva` e remove o `-wal` e o `-shm` do nome antigo. Outra instância pode ter mudanças já confirmadas no WAL. Com duas conexões e uma nota confirmada após o último checkpoint, repetir as operações de disco da renomeação deixou a nota ausente em uma cópia isolada do arquivo movido. Uma tentativa de abrir o arquivo movido enquanto a conexão original ainda estava ativa também retornou `SQLITE_IOERR_SHORT_READ` no ensaio. O efeito depende do estado do WAL e do comportamento do sistema de arquivos.

**A considerar.** Resolver a identidade do arquivo e coordenar o acesso entre instâncias antes de renomear ou mover um projeto para a lixeira. Fazer checkpoint sob controle exclusivo antes de mover e testar a operação com dois processos. [Renomeação e lixeira](../src/main/services/projectFile.ts#L34) · [SQLite em WAL](../src/main/db/index.ts#L18) · [Inicialização do aplicativo](../src/main/index.ts#L176)

### LA-02 · Edições separadas podem apagar uma citação cujo texto ficou intacto

**Reproduzido.** Codifique `sim` na linha entre um título e um rodapé, edite somente essas duas linhas e salve uma vez. A citação de `sim` desaparece. O ajuste resume as duas mudanças em um único intervalo entre o prefixo e o sufixo comuns. A citação intermediária entra na lista de remoções, e a recuperação por busca exige ao menos 20 caracteres úteis e ocorrência única. O mesmo ajuste pode desvincular notas de trechos intactos. O histórico permite desfazer durante a sessão.

**A considerar.** Registrar operações de edição ou representar múltiplos intervalos. Compartilhar o cálculo entre a prévia e o salvamento e mostrar quais âncoras serão removidas ou desvinculadas antes de aplicar a edição. [Cálculo dos intervalos](../src/shared/editAdjust.ts#L24) · [Regras de ajuste](../src/shared/editAdjust.ts#L55) · [Exclusão no salvamento](../src/main/db/repositories.ts#L217) · [Editor](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L1187)

## P2 · Dados e interoperabilidade

### LA-03 · QDPX com CRLF inline pode deslocar citações e notas

**Reproduzido com um QDPX sintético no nível do parser e da importação.** Para um fluxo que grava offsets sobre o texto inline com CRLF, `a\r\nb c` com intervalo `[3,4)` deveria marcar `b`. O parser entrega `a\nb c`, e o banco aceita o intervalo ainda válido sobre o espaço. A validação de faixa também não detecta um deslocamento equivalente em uma nota. Esse cenário usa `PlainTextContent` inline. O exportador do LivreAnalise grava o texto dos documentos em entradas separadas no ZIP.

**A considerar.** Definir a convenção de offsets por origem e testar fontes inline e externas com CRLF, LF, acentos e caracteres fora do plano básico. Quando a convenção for incerta, relatar a ambiguidade ao importar. [Leitura da fonte e dos offsets](../src/main/qdpx/xml.ts#L247) · [Importação de citações](../src/main/qdpx/import.ts#L102) · [Importação de notas](../src/main/qdpx/import.ts#L188) · [Exportação em ZIP](../src/main/qdpx/serialize.ts#L7)

### LA-04 · Vínculos de grupo ausentes somem do relatório QDPX

**Reproduzido.** Uma entrada `MemberCode` que aponta para um código ausente gera um grupo importado com zero membros e uma lista de avisos vazia. Os totais informados ao usuário podem parecer completos mesmo quando a composição do grupo mudou.

**A considerar.** Informar o grupo e a referência ausente, além de mostrar totais de vínculos preservados e descartados. [Resolução dos membros do grupo](../src/main/qdpx/import.ts#L78) · [Exibição do relatório](../src/renderer/src/stores/appStore.ts#L288)

### LA-05 · Interromper uma exportação pode danificar a cópia que já existia

**Inspeção.** Após a confirmação de sobrescrita, QDPX e a exportação para IA gravam diretamente no caminho final. Uma falha de escrita, como disco cheio, pode deixar a exportação anterior truncada ou substituída por um arquivo incompleto.

**A considerar.** Gravar ao lado do destino, publicar após concluir a escrita e preservar a cópia anterior até essa etapa. Cobrir falha entre a abertura e o término da escrita para os dois formatos. [Escrita QDPX](../src/main/qdpx/export.ts#L151) · [Escrita da exportação para IA](../src/main/ipc/aiExport.ts#L101) · [Helper de escrita atômica](../src/main/services/atomicFile.ts#L5)

### LA-06 · A exportação pode usar um projeto diferente do que abriu o diálogo

**Inspeção.** Os dois fluxos capturam o nome e abrem o seletor de destino antes de consultar os dados finais. Se o projeto ativo mudar nesse intervalo, as consultas usam o banco que estiver ativo depois do diálogo. A exportação para IA no escopo Documento também reutiliza o ID numérico original, que pode corresponder a outro documento no novo banco. A mudança é relevante para entrevistas destinadas a compartilhamento. A possibilidade de intercalar a transição pela interface depende do comportamento do diálogo na plataforma.

**A considerar.** Vincular a operação ao identificador da sessão do projeto e conferir essa identidade antes de ler ou publicar a exportação. Simular troca de projeto durante um seletor pendente nos testes de IPC. [IPC QDPX](../src/main/ipc/qdpx.ts#L15) · [IPC de exportação para IA](../src/main/ipc/aiExport.ts#L60) · [Proteção usada na importação de documentos](../src/main/ipc/documents.ts#L22)

### LA-07 · A tela de versões esconde falhas de leitura

**Inspeção.** O serviço preserva um manifesto ilegível e lança um erro explicativo. O store converte a rejeição em uma lista vazia e o diálogo exibe “Nenhuma versão ainda”. Isso torna uma falha do catálogo indistinguível da ausência de checkpoints e pode induzir a pessoa a concluir que perdeu a cópia de migração.

**A considerar.** Exibir um estado de erro com a pasta de versões e uma forma de tentar novamente. Manter o manifesto e os arquivos disponíveis para diagnóstico. [Leitura do manifesto](../src/main/services/projectVersions.ts#L87) · [Atualização do store](../src/renderer/src/stores/appStore.ts#L508) · [Estado vazio](../src/renderer/src/components/workspace/VersionsDialog.tsx#L98)

### LA-08 · Falha ao registrar um recente pode deixar o banco e a tela fora de sincronia

**Inspeção.** Abrir, criar, importar ou restaurar ativa o banco novo antes de atualizar a lista de recentes. Se o arquivo de preferências estiver sem permissão ou com o disco cheio, a escrita lança e a operação rejeita. O renderer só publica o novo projeto após sucesso do IPC, então pode continuar mostrando a biblioteca ou o projeto anterior enquanto o banco ativo já mudou.

**A considerar.** Tratar a gravação de recentes como tarefa auxiliar após a transição, com erro próprio, e testar retorno parcial em cada entrada. [Abertura e criação](../src/main/ipc/project.ts#L60) · [Restauração](../src/main/ipc/versions.ts#L78) · [Escrita de recentes](../src/main/services/recentsStore.ts#L22) · [Estado do renderer](../src/renderer/src/stores/appStore.ts#L308)

## P2 · Interface e transcrição

### LA-09 · Cancelar um seletor fecha o diálogo anterior sem concluir a ação

**Reproduzido no Electron Linux, com respostas de cancelamento simuladas nos seletores nativos.** Na criação de projeto, cancelar a escolha da pasta descarta a etapa de nome. Em Versões, cancelar o seletor de destino fecha a lista. Por inspeção, a importação QDPX compartilha a etapa de nome e cancelar a confirmação de migração também encerra o fluxo de restauração com o mesmo retorno. Os componentes interpretam a resolução da chamada como sucesso, embora o store retorne sem criar ou restaurar.

**A considerar.** Propagar se a operação foi concluída ou cancelada e fechar o diálogo após confirmação de sucesso. Preservar o nome digitado e o foco ao voltar do seletor. [Diálogo de nome](../src/renderer/src/components/workspace/SimplePromptDialog.tsx#L42) · [Criação e importação](../src/renderer/src/stores/appStore.ts#L266) · [Restauração](../src/renderer/src/components/workspace/VersionsDialog.tsx#L66)

### LA-10 · Criar citações e notas de trecho depende do mouse

**Inspeção.** O conteúdo de leitura só abre o popover para a seleção após `mouseup`. Uma seleção feita por navegação de cursor não oferece ação equivalente para aplicar um código, criar nota de trecho ou religar uma âncora. Os controles por teclado de ajuste de uma citação já existente cobrem outra etapa do fluxo.

**A considerar.** Oferecer um comando de teclado sobre a seleção e controlar a entrada e a devolução de foco do popover. Cobrir seleção, criação e cancelamento no Electron com navegação por teclado. [Criação da seleção pendente](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L863) · [Evento na área de leitura](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L1342) · [Ações do popover](../src/renderer/src/components/workspace/CodingPopover.tsx#L114)

### LA-11 · O código realçado pode divergir do escolhido por Enter

**Inspeção.** Com a busca vazia e o último código usado fora da primeira posição da lista, o popover destaca esse código no topo com “último”. Enter aplica o primeiro item da lista filtrada original. O ID do último código também fica retido entre projetos, de modo que um ID reutilizado em outro banco pode aparecer como se já tivesse sido aplicado ali.

**A considerar.** Usar a mesma ordenação e seleção ativa para exibição, foco e Enter. Guardar o último código por projeto ou limpar na troca. [Seleção por Enter](../src/renderer/src/components/workspace/CodingPopover.tsx#L46) · [Item destacado](../src/renderer/src/components/workspace/CodingPopover.tsx#L140) · [Fechamento do projeto](../src/renderer/src/stores/appStore.ts#L319)

### LA-12 · A consulta de tamanho do modelo não oferece cancelamento

**Inspeção.** Durante “Consultando o tamanho do modelo…”, o botão Voltar fica desabilitado e a tela não renderiza Cancelar. A requisição de metadados pode passar por vários redirecionamentos, com prazo de 15 segundos em cada etapa. Em uma rede lenta, o usuário fica aguardando a resposta para retomar a navegação.

**A considerar.** Oferecer cancelamento ou usar o tamanho aproximado já exibido quando a consulta demorar. Incluir estado de download, progresso e resultado na árvore de acessibilidade. [Estado de consulta](../src/renderer/src/components/transcribe/TranscribeView.tsx#L139) · [Controles da tela](../src/renderer/src/components/transcribe/TranscribeView.tsx#L355) · [Consulta HTTP](../src/main/services/download.ts#L22) · [Cartão de progresso](../src/renderer/src/components/transcribe/TranscribeView.tsx#L449)

### LA-13 · A transcrição pode terminar o processamento e falhar ao salvar

**Inspeção.** O resultado é gravado ao lado da mídia original, depois de converter o áudio e rodar o Whisper. Com mídia em uma pasta legível mas sem escrita, o erro só aparece no fim. A interface mostra o texto acumulado durante a sessão, porém não oferece salvar em outra pasta a partir do resultado.

**A considerar.** Escolher ou verificar um destino gravável antes de transcrever e permitir salvar novamente após falha de escrita sem executar o Whisper de novo. [Conversão, processamento e saída](../src/main/services/transcription.ts#L80) · [Caminho da transcrição](../src/main/services/transcript.ts#L79) · [Resultado e erro na interface](../src/renderer/src/components/transcribe/TranscribeView.tsx#L406)

## P2 · Desempenho

### LA-14 · Cada termo de busca reconstrói o índice do documento inteiro

**Medido.** Com texto sintético acentuado, sem ocorrências, `acharOcorrencias` levou aproximadamente **205 ms, 801 ms e 1.659 ms** para 1.048.576, 4.194.304 e 8.388.608 unidades UTF-16, em uma execução com Node 24 no Linux. Os tempos medem a função, antes dos destaques e da montagem das linhas. O renderer normaliza caractere por caractere e aloca um mapa de offsets a cada termo, inclusive quando nenhuma ocorrência é encontrada.

**A considerar.** Reutilizar a normalização e o mapa enquanto a revisão do texto for a mesma. Perfilar digitação, memória e renderização com transcrições longas para decidir quais etapas devem rodar fora da interface. [Busca e mapa de offsets](../src/shared/busca.ts#L39) · [Recálculo no renderer](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L509)

### LA-15 · A área de trabalho mede e monta a transcrição inteira

**Inspeção.** A leitura mantém no DOM as linhas, realces, rótulos e marcadores do documento. O efeito de layout e o `ResizeObserver` medem intervalos com `Range.getClientRects()` para todas as citações e notas. O custo tende a crescer também com a extensão em linhas de cada seleção. O código usa busca binária e evita repetir a medição no hover, mas uma mudança de largura ainda dispara a medição global.

**A considerar.** Registrar tempos de montagem e redimensionamento com documentos extensos e anotações densas. Avaliar renderização por janela com suporte a seleção, busca, navegação e restauração da posição. [Medição dos intervalos](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L642) · [Citações e notas](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L756) · [Observador de tamanho](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L850)

### LA-16 · Importações acumulam o lote em memória antes de publicar

**Inspeção.** A importação multi-arquivo extrai sequencialmente e mantém o conteúdo de todos os documentos no processo principal até gravar a transação. Os limites TXT e DOCX são por arquivo. Para QDPX, há tetos de ZIP e texto expandido, mas a leitura ainda mantém texto e objetos descompactados, e o parse XML e os inserts síncronos rodam no processo principal. Dependendo do volume, a interface pode perder responsividade e não oferece progresso ou cancelamento durante a extração.

**A considerar.** Medir memória e latência com lotes representativos e transações grandes. Considerar staging em disco, limite por lote e processamento isolado com progresso, mantendo a publicação integral do lote. [Importação de documentos](../src/main/ipc/documents.ts#L22) · [Limites TXT e DOCX](../src/main/services/textExtract.ts#L18) · [Importação QDPX](../src/main/qdpx/import.ts#L270) · [Leitura do ZIP](../src/main/qdpx/zipReader.ts#L6)

## P3 · Manutenção e cobertura

### LA-17 · A busca no documento e o filtro de lista discordam sobre Unicode

**Reproduzido.** Buscando `ΟΣ` em um texto que contém exatamente `ΟΣ`, o filtro de lista retorna verdadeiro, mas a busca de ocorrências retorna zero. O filtro converte a palavra como unidade e o mapeamento de ocorrências converte cada unidade UTF-16 separadamente. O sigma final do grego depende do contexto da palavra.

**A considerar.** Compartilhar a regra de normalização e testar texto multilíngue com offsets, incluindo sigma final, acentos combinantes e alfabetos com letras fora do plano básico. [Normalização e filtro](../src/shared/busca.ts#L9) · [Normalização de ocorrências](../src/shared/busca.ts#L39)

### LA-18 · A abertura da biblioteca repete consultas síncronas

**Inspeção.** O bootstrap e a biblioteca carregam os recentes de forma independente na inicialização. Cada listagem pode reabrir até 15 bancos e executar três contagens por projeto no processo principal. O custo também aparece quando uma unidade externa ou pasta de rede responde lentamente.

**A considerar.** Consolidar a carga inicial e atualizar as métricas de forma incremental com cache invalidado por mudança de arquivo. [Bootstrap](../src/renderer/src/stores/appStore.ts#L232) · [Carga na biblioteca](../src/renderer/src/components/home/HomeLibrary.tsx#L53) · [Listagem de recentes](../src/main/ipc/project.ts#L117) · [Consultas SQLite](../src/main/db/projectStats.ts#L10)

### LA-19 · A CI deixa o fluxo desktop e parte dos riscos multiplataforma para a distribuição

**Inspeção.** A suíte da branch roda em Ubuntu, incluindo os testes de interface em jsdom. O workflow de distribuição checa FFmpeg e o ABI SQLite no pacote em quatro ambientes, porém não executa um fluxo de interface do aplicativo empacotado. As operações nativas de diálogo, atalhos, permissões e cancelamento de processos no Windows e no macOS ficam expostas a regressões que a CI do pull request não cobre.

**A considerar.** Acrescentar um smoke do Electron com perfil temporário nos alvos nativos, focado nos caminhos com maior impacto, como abrir e salvar projeto, exportar, cancelar transcrição e fechar com alterações pendentes. [CI da branch](../.github/workflows/ci.yml#L14) · [Matriz de pacotes](../.github/workflows/build.yml#L20) · [Checagem de binários empacotados](../.github/workflows/build.yml#L90)

### LA-20 · A lógica de projeto e de geometria está concentrada e duplicada

**Inspeção.** `appStore.ts` mantém estado da sessão, navegação, histórico, versões e autosave. Criar, abrir e restaurar montam conjuntos diferentes de campos ao trocar de projeto. `TranscriptPanel.tsx` tem 1.702 linhas e concentra edição, geometria, busca, notas, teclado e mouse. Regras compartilhadas de troca e âncoras ficam dispersas entre caminhos de atualização e efeitos de renderização, o que aumenta o número de cenários necessários para verificar alterações.

**A considerar.** Concentrar a inicialização e limpeza do estado por sessão e isolar o cálculo de âncoras e a medição do layout atrás de contratos que possam ser exercitados de forma independente. [Criação e troca](../src/renderer/src/stores/appStore.ts#L266) · [Restauração](../src/renderer/src/stores/appStore.ts#L529) · [Pipeline de segmentos e busca](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L472) · [Medição de layout](../src/renderer/src/components/workspace/TranscriptPanel.tsx#L642)

## Verificação

- Linux x64 com Node 24.18.1. `npm run typecheck`, `npm run build` e `npm test` passaram. A suíte existente teve **562 testes em 74 arquivos**, seguida pela recompilação bem-sucedida do módulo SQLite para o Electron. O teste inicial no sandbox bloqueou loopback e subprocessos. A execução isolada com essas capacidades passou.
- Os ensaios de dados usaram bancos SQLite, XML e texto sintéticos descartáveis. A medição de busca é uma amostra local, sem benchmark de distribuição ou de dispositivos mais lentos.
- O build do Electron abriu a biblioteca no Linux com perfil temporário. No mesmo ensaio foram observados os dois cancelamentos de LA-09. A auditoria de fluxos nativos no Windows e no macOS, a interoperabilidade com versões instaladas de outros programas e uma transcrição completa com download de modelo ficam fora da verificação executada.
