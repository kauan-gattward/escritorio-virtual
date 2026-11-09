# O Escritório

Escritório virtual privado do Kauan. É um site estático, sem servidor e sem serviço pago: salas isométricas no estilo de um jogo de pixels, com arte 100% original (nenhum desenho, nome, fonte ou marca da Habbo/Sulake). A interface está em português do Brasil.

A fase 1 deixa o lugar jogável e prepara o encanamento das tarefas. A conexão de verdade com os agentes entra na fase 2.

## Publicar no GitHub Pages

O site mora em `/docs`. No GitHub:

1. Abra **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**.
3. Branch **main**, pasta **/docs**. Salve.

A URL fica:

`https://kauan-gattward.github.io/escritorio-virtual/`

Este repositório não habilita o Pages sozinho: a ferramenta usada aqui só lê o GitHub, não altera a configuração do repositório. O passo acima é manual e leva um minuto.

Não use a raiz do repositório como origem do Pages. `tools/` e este README não fazem parte do site.

## Entrar

O escritório abre numa tela de senha. A senha nunca é gravada, nunca vai para o Git e não aparece em log.

- Mínimo de 8 caracteres.
- Enquanto **não existir** `docs/data/config.enc.json`, a primeira senha digitada neste navegador vira a senha dele. Um verificador cifrado fica só no `localStorage`. Outro aparelho não herda essa senha.
- Quando `config.enc.json` estiver no site, a senha tem de abrir esse arquivo. Use a **mesma** senha do navegador, senão as tarefas locais não decifram.
- **Travar** recarrega a página e esquece a sessão.

Sem `config.enc.json` (é o que este repositório entrega), aparece o aviso de primeira execução. As tarefas ficam neste aparelho com o estado **aguardando conexão**.

## Como jogar

- Toque ou clique num piso para andar. O caminho usa A* em 8 direções, com animação de passo.
- Arraste para mover a câmera. Roda do mouse aproxima. No celular, dois dedos aproximam e arrastam.
- Portas na parede trocam de sala. O botão **Salas** também.
- **Acenar**, **Sentar** (cadeira ou sofá) e **Dançar**.
- Clique num avatar para abrir a ficha. Num colega, a ficha também pede tarefa e lista o que já foi pedido.
- **Catálogo** põe móveis na mochila. **Mochila** escolhe um para colocar no piso. **Mover** arrasta. Com um móvel selecionado, **Girar** e **Pegar**.
- **Visual** muda pele, cabelo, camisa, calça e a frase do Kauan.
- O balão de cada colega diz **livre**, **trabalhando** ou **resposta pronta**.
- Falar no campo de baixo solta um balão que sobe e some.

Salas: **Recepção**, **Open Office** (uma mesa por agente), **Sala de Reunião**, **Sala do Kauan**.

Colegas: Nexo, Mochi, Jarvis, Tati, Alex, Alexandre e Unibot. Cada um tem visual próprio. Eles sentam na própria cadeira e, de vez em quando, dão uma volta curta.

Móveis do catálogo: escrivaninha, cadeira, computador, planta, sofá, quadro branco, cafeteira, mesa de reunião, tapete e luminária.

Layout e visual ficam no navegador (`escritorio.layout.v1` e `escritorio.avatar.v1`). Isso não é segredo. **Restaurar móveis desta sala** no navegador de salas devolve o arranjo original e guarda na mochila o que veio do catálogo.

O desenho é um canvas só, sem framework. O pixel ratio é limitado a 2. Em teste automatizado no Chrome a cena ficou em 60 fps.

## Tarefas (fase 1)

O módulo é `docs/js/tasks.js`.

- `sendTask(agent, text)` cria `{ agent, text, id, createdAt }`.
- Se o `config.enc.json` tiver `webhookUrl` e `senderKey`, faz `POST` desse JSON, com o cabeçalho da chave. Se o POST responde OK, a tarefa fica **enviada**.
- Se não houver config, ou se a rede falhar, a tarefa fica na fila local com o texto **aguardando conexão**.
- `loadResults()` lê `docs/data/results.enc.json`, decifra com a mesma senha e casa pelo `id`. Sem o arquivo (404), não há respostas. O app tenta de novo a cada 60 segundos e pelo botão **Atualizar respostas**.

Identificadores dos agentes: `nexo`, `mochi`, `jarvis`, `tati`, `alex`, `alexandre`, `unibot`.

O `id` tem a forma `task_` mais um UUID. `createdAt` é ISO-8601 em UTC.

Estados na interface:

| Estado na tela | Significado |
| --- | --- |
| `aguardando conexão` | Ainda não saiu deste aparelho |
| `enviada` | O webhook aceitou o POST |
| `trabalhando` | O arquivo de resultados marcou `working` |
| `resposta pronta` | O arquivo marcou `done` |
| `erro` | O arquivo marcou `error` |

O balão usa só três palavras: resposta pronta (se houver resposta não lida), senão trabalhando (fila, enviada ou working), senão livre.

## Formatos

### POST do webhook

Corpo, sem campos extras:

```json
{
  "agent": "nexo",
  "text": "Preparar a pauta da reunião",
  "id": "task_3f1c0b2e-7a4d-4e5f-9c1a-2b6d8e0f4a11",
  "createdAt": "2026-11-09T18:40:00.000Z"
}
```

Cabeçalhos: `Content-Type: application/json` e o cabeçalho da chave. O nome padrão é `X-Escritorio-Key`. Dá para trocar com `senderKeyHeader` na config. O navegador manda `referrerPolicy: no-referrer`.

O webhook precisa responder CORS para a origem do Pages (`https://kauan-gattward.github.io`), senão o POST falha e a tarefa continua **aguardando conexão**.

### Config em claro (não commitar)

Arquivo que o `encrypt.js` lê. Não deixe este JSON no Git.

```json
{
  "v": 1,
  "webhookUrl": "https://exemplo.invalid/webhook",
  "senderKey": "troque-esta-chave",
  "senderKeyHeader": "X-Escritorio-Key"
}
```

`senderKeyHeader` é opcional. `webhookUrl` e `senderKey` são obrigatórios e não vazios.

### Resultados em claro (não commitar)

```json
{
  "v": 1,
  "results": [
    {
      "id": "task_3f1c0b2e-7a4d-4e5f-9c1a-2b6d8e0f4a11",
      "agent": "nexo",
      "status": "done",
      "response": "Pauta pronta: abertura, decisões, próximos passos.",
      "updatedAt": "2026-11-09T19:00:00.000Z"
    }
  ]
}
```

`status` só pode ser `working`, `done` ou `error`. `response` é sempre string. O `id` tem de ser o mesmo que foi no POST.

### Envelope cifrado

`config.enc.json`, `results.enc.json` e a fila local usam o mesmo envelope. A tag GCM de 16 bytes vem **colada no fim** do ciphertext, como o Web Crypto entrega. Não separe a tag.

```json
{
  "v": 1,
  "alg": "AES-GCM",
  "kdf": "PBKDF2",
  "hash": "SHA-256",
  "iterations": 210000,
  "salt": "<base64 de 16 bytes>",
  "iv": "<base64 de 12 bytes>",
  "ciphertext": "<base64 de ciphertext || tag>"
}
```

A chave é AES-256. Ela sai da senha com PBKDF2-HMAC-SHA-256, 210000 iterações, sal e IV novos por arquivo. Cada arquivo tem o próprio sal, então a chave derivada não é reaproveitada entre arquivos: a senha é a mesma, o teste é a tag GCM. Na leitura, iterações abaixo de 200000 ou acima de 5000000 são recusadas.

## Ferramentas

A senha entra só pela variável `OFFICE_APP_PASSWORD`. Não passe senha em argumento. Os scripts não imprimem a senha nem o conteúdo.

```bash
export OFFICE_APP_PASSWORD='uma senha longa'
node tools/encrypt.js config ./secrets/config.json
node tools/encrypt.js results ./secrets/results.json
node tools/encrypt.js decrypt docs/data/results.enc.json /tmp/results.json
```

Sem o terceiro argumento, a config vai para `docs/data/config.enc.json` e os resultados para `docs/data/results.enc.json`. O `decrypt` exige o caminho de saída e grava texto puro: não commite esse arquivo.

Conferir o formato, sem imprimir segredo:

```bash
node tools/selftest.js
```

A saída é só `OK` ou `FAIL`.

## Fase 2

O que já está pronto: salas, caminho, móveis, chat, ficha, fila cifrada e a leitura de `results.enc.json`.

O que falta ligar de verdade:

1. Criar o JSON de config com a URL do webhook e a chave. Cifrar com a **mesma** senha da tela. Publicar só o `docs/data/config.enc.json`.
2. O webhook recebe o POST, executa o agente e, depois, grava um `results.json` no formato acima.
3. Cifrar esse arquivo para `docs/data/results.enc.json` e publicar. O escritório passa a mostrar **trabalhando** ou **resposta pronta**.

Nada disso exige servidor dentro deste repositório.

## Privacidade

O código do site é público. O que é privado (URL do webhook, chave, texto das tarefas e respostas) só existe cifrado, ou só na memória da sessão. Não há `config.enc.json` neste commit de propósito: ainda não há senha definida para o Kauan. Não commite JSON em claro, `.env` ou a variável `OFFICE_APP_PASSWORD`.
