# O Escritório

Escritório virtual do Kauan, em português, num site estático. A arte é pixel isométrico original: nenhum desenho, nome ou marca da Habbo/Sulake. Não há servidor nem serviço pago.

O jogo abre na fachada do prédio. Cada andar é um mapa contínuo. A câmera segue o avatar e só desenha o que está na tela.

## Publicar

O site está em `/docs`. No GitHub: **Settings → Pages → Deploy from a branch → main → /docs**.

URL: https://kauan-gattward.github.io/escritorio-virtual/

## Senha

A senha (8 caracteres ou mais) é a única chave. Ela deriva AES-256 com PBKDF2-HMAC-SHA-256, 210000 iterações. O mesmo segredo abre o escritório no celular e no computador e decifra `results.enc.json` quando o Nexo publicar esse arquivo.

- Se o arquivo de resultados existir, a senha tem de abri-lo.
- Se não existir, a senha deste navegador abre o cofre local (`escritorio.vault.v1`).
- Não há chave aleatória por aparelho. Cada arquivo leva o próprio sal dentro do envelope; a senha é a mesma.
- A URL do webhook e a chave do remetente ficam só nesse cofre cifrado. Não entram no Git.
- **Travar** recarrega a página e esquece a sessão.

## O prédio

| Andar | Salas |
| --- | --- |
| Térreo | Recepção e Copa |
| 1º andar | Open Office e Sala de Reunião |
| 2º andar | Sala de Projetos e Arquivo |
| Cobertura | Sala do Kauan |

Toque num andar da fachada para aproximar. Dentro do andar, ande pelo corredor. O elevador e a escada trocam de andar. **Salas** teletransporta. **Prédio** volta para a fachada, com um zoom curto.

Nas janelas da fachada, bonequinhos minúsculos repetem a posição de quem está naquele andar, atualizados cerca de oito vezes por segundo.

## Como jogar

- Toque num piso para andar (A* em 8 direções).
- A câmera segue. Arrastar olha em volta; ao andar de novo, ela volta a seguir. Pinça ou a roda aproximam.
- Chegue perto de um móvel com função e toque nele: a ficha abre.
- Acenar, sentar, dançar, catálogo (por categoria, com busca), mochila, mover, girar e pegar continuam. O catálogo tem móveis, eletrônicos, decoração, plantas e cozinha. Os desenhos ficam em cache para não pesar.
- Sentar numa cadeira da mesa de reunião abre o chat privado da mesa. Levantar fecha. Dá para chamar um agente: ele atravessa a sala e senta.
- **Ferramentas**: notas, lista, pomodoro, calculadora, calendário, busca e pedido rápido.
- **Ajustes**: conexão dos agentes.

O que cada sala faz:

- **Recepção** (mesa): agenda de hoje, pendências por agente e registro de visita (nome, telefone, origem). O quadro é o mural.
- **Copa**: a cafeteira liga um lofi gerado no navegador. O sofá marca o humor.
- **Open Office**: cada escrivaninha pede tarefa àquele agente e mostra o histórico. O quadro é o kanban A fazer / Fazendo / Feito.
- **Sala de Reunião**: a mesa manda a mesma pergunta a vários agentes, com um `meetingId` compartilhado, timer e respostas lado a lado. O quadro guarda notas.
- **Sala de Projetos**: cartões de Blue Ocean Flats, Vida de Sereia, Futveco, Pepita do Dia e Leads app, com status, próximo passo e link.
- **Arquivo**: busca e guarda textos. Dá para copiar as respostas prontas para lá.
- **Sala do Kauan**: notas na mesa, metas no quadro, pomodoro na luminária, links no computador, vendas na cafeteira.

Colegas: Nexo (na recepção), Mochi, Jarvis, Tati, Alex, Alexandre e Unibot. O balão diz livre, trabalhando ou resposta pronta.

Layout e visual continuam no navegador (`escritorio.layout.v2` e `escritorio.avatar.v1`). O mapa novo ignora o layout da fase 1.

## Conexão dos agentes

Em **Ajustes → Conexão dos agentes**, cole a URL do webhook e a chave. Os dois ficam cifrados no cofre local. Ao guardar, a fila **aguardando conexão** é reenviada.

`sendTask(agent, text, room)` faz `POST` com este JSON, nesta ordem de campos:

```json
{
  "id": "task_3f1c0b2e-7a4d-4e5f-9c1a-2b6d8e0f4a11",
  "agent": "nexo",
  "text": "Preparar a pauta",
  "createdAt": "2026-11-09T18:40:00.000Z",
  "room": "recepcao"
}
```

Cabeçalho padrão:

```http
Authorization: Bearer <chave>
Content-Type: application/json
```

O nome do cabeçalho é configurável. Se for `Authorization`, o valor ganha o prefixo `Bearer `, a menos que a chave já comece com `Bearer `. Se o nome for outro, a chave vai crua nesse cabeçalho.

O chat privado da mesa (quando você senta numa cadeira ao lado da mesa de reunião) manda um POST por agente convidado, com os mesmos campos e mais dois:

```json
"channel": "mesa-reuniao",
"history": [
  { "from": "kauan", "text": "mensagem anterior" },
  { "from": "tati", "text": "resposta anterior" }
]
```

`history` traz até 10 falas anteriores, só como contexto. A fala nova vai em `text`. A resposta volta no `results.enc.json` com o mesmo `meetingId` e aparece no chat da mesa e num balão sobre o agente. O histórico fica cifrado no cofre do navegador. Sem webhook, a janela avisa que nada sai do aparelho.

Uma reunião pelo botão da mesa manda um POST por agente, com o mesmo texto e um campo extra:

```json
"meetingId": "meet_8c2a1d40-1b2e-4f6a-9d11-0aa1bb22cc33"
```

Se o `fetch` em modo `cors` falhar, o app tenta de novo com `mode: 'no-cors'` e corpo `text/plain` (o mesmo JSON). Esse segundo envio não pode levar cabeçalho de autorização: o navegador bloqueia. A tarefa é marcada como enviada e a tela explica o CORS. Se os dois envios falharem, ela fica **aguardando conexão**.

O webhook precisa liberar CORS para `https://kauan-gattward.github.io` se quiser que o app leia o status HTTP. Sem isso, vale o envio opaco acima.

## Resultados

O app busca, a cada 60 segundos e ao voltar o foco:

1. `./data/results.enc.json?t=<agora>`
2. se não achar, `https://raw.githubusercontent.com/kauan-gattward/escritorio-virtual/main/docs/data/results.enc.json?t=<agora>`

Arquivo ausente não é erro. Se `docs/data/results.enc.json` estiver no site, a senha da tela tem de ser a mesma usada no `encrypt.js`.

O JSON decifrado é:

```json
{
  "updatedAt": "2026-11-09T19:00:00.000Z",
  "results": [
    {
      "id": "task_3f1c0b2e-7a4d-4e5f-9c1a-2b6d8e0f4a11",
      "agent": "nexo",
      "status": "resposta pronta",
      "response": "Pauta pronta.",
      "updatedAt": "2026-11-09T19:00:00.000Z",
      "meetingId": "meet_8c2a1d40-1b2e-4f6a-9d11-0aa1bb22cc33"
    }
  ]
}
```

`status` é `trabalhando`, `resposta pronta` ou `erro`. `meetingId` é opcional. O formato antigo (`working`, `done`, `error`) ainda é aceito.

O balão usa a resposta não lida, senão uma tarefa em andamento, senão livre.

## Cifrar e decifrar

A senha só entra por `OFFICE_APP_PASSWORD`. Nada é impresso pelo cifrador além do caminho de saída.

```bash
export OFFICE_APP_PASSWORD='uma senha longa'
node tools/encrypt.js ./secrets/results.json docs/data/results.enc.json
node tools/decrypt.js docs/data/results.enc.json
```

`encrypt.js` aceita qualquer objeto JSON. `decrypt.js` imprime o JSON na saída padrão: rode só na máquina do Nexo, porque ali o texto puro aparece.

O envelope é o mesmo da fase 1:

```json
{
  "v": 1,
  "alg": "AES-GCM",
  "kdf": "PBKDF2",
  "hash": "SHA-256",
  "iterations": 210000,
  "salt": "<base64 de 16 bytes>",
  "iv": "<base64 de 12 bytes>",
  "ciphertext": "<base64 de ciphertext || tag GCM de 16 bytes>"
}
```

```bash
node tools/selftest.js
```

A saída é só `OK` ou `FAIL`.

## O que fica no navegador

Tudo isto é cifrado com a senha, no `localStorage`:

- cofre (`escritorio.vault.v1`): conexão, notas, lista, metas, visitas, mural, quadro da reunião, vendas, links, projetos, arquivo, humor, agenda, pomodoro
- fila de tarefas (`escritorio.tasks.v1`)

Layout dos móveis e cores do avatar não são segredo.
