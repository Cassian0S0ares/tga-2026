# Bolão TGA 2026

Bolão do The Game Awards 2026 para jogar entre amigos. Servidor Node sem dependências.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

- **Windows:** dê dois cliques em `run.bat`. Ele abre o navegador e sobe o servidor.
- **Qualquer sistema:** `npm start` (ou `node server.js`) e abra `http://localhost:3030`.

Quem está na mesma rede acessa pelo IP da máquina, por exemplo `http://192.168.0.10:3030`.

## Modo demo

`demo.bat` (ou `node server.js --demo`) sobe um ensaio da cerimônia na porta seguinte (`3031`):

- gera palpites aleatórios para todos os jogadores;
- deixa a votação já encerrada, para testar a cerimônia, o placar e a retrospectiva;
- grava em `data/db.demo.json`, então o bolão real (`data/db.json`) não é tocado;
- recomeça do zero a cada vez que é iniciado.

Pode rodar junto com o bolão real.

## Regras de pontuação

- Cada jogador escolhe um indicado por categoria até o prazo (`lockAt`).
- Acertar vale o **peso da categoria**: Jogo do Ano vale 3, as categorias de destaque valem 2 e as demais valem 1.
- **Azarão vale 3×.** São as duas menores cotações da categoria na pesquisa da DOXA, desde que sejam de até 15% e fiquem abaixo do segundo colocado. Detalhes e a tabela completa em [PREVISOES-DOXA.md](PREVISOES-DOXA.md).
- Os palpites dos outros só aparecem depois do prazo.
- O ponto entra no placar quando o vencedor é registrado na Cerimônia ou no Admin.

## Configuração

Tudo fica em `data/config.json`:

| Campo | Para que serve |
|---|---|
| `players` | Jogadores. `previousName` migra os palpites de um nome antigo. |
| `adminToken` | Senha para registrar vencedores. **Troque antes de usar.** |
| `lockAt` | Fim dos palpites, com fuso (`2026-12-10T21:30:00-03:00`). |
| `port` | Porta do servidor. O modo demo usa `port + 1`. |
| `weights` / `defaultWeight` | Peso de cada categoria, pelo id (nome em minúsculas, com hífens). |
| `upsetMultiplier` | Multiplicador do azarão. |

Reinicie o servidor depois de mudar a configuração.

## Arquivos

- `server.js`: API e arquivos estáticos.
- `data/categories.js`: categorias e indicados.
- `data/doxa-2026.json`: cotações fixas usadas para favoritos e azarões.
- `data/db.json`: palpites e vencedores. Fica fora do git, então faça backup.
- `public/`: interface (`bolao.js`, `gala.css`, artes e fontes).
