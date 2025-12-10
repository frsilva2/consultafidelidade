# Configuração da API Segura (Google Apps Script)

Este guia explica como configurar a API para proteger seus dados da planilha.

## Vantagens desta solução

- **Planilha 100% privada** - Não precisa mais publicar na web
- **Token de segurança** - Só quem tem o token acessa os dados
- **Controle total** - Você decide quem pode acessar
- **Gratuito** - Usa recursos do Google sem custo

---

## Passo 1: Criar o Google Apps Script

1. Acesse [script.google.com](https://script.google.com/)
2. Clique em **"Novo projeto"**
3. Apague o código padrão e cole o conteúdo do arquivo `google-apps-script.js`

## Passo 2: Configurar o Script

No início do código, configure:

```javascript
const SPREADSHEET_ID = 'SEU_ID_AQUI';  // Veja abaixo como encontrar
const API_TOKEN = 'seu_token_secreto'; // Crie um token único
const MAIN_SHEET_NAME = 'Página1';     // Nome da aba principal
const EXPIRED_SHEET_NAME = 'Pagina1';  // Nome da aba de expirados
```

### Como encontrar o SPREADSHEET_ID:
Abra sua planilha no Google Sheets. A URL será algo como:
```
https://docs.google.com/spreadsheets/d/ABC123XYZ456/edit
```
O ID é a parte `ABC123XYZ456` (entre `/d/` e `/edit`)

## Passo 3: Implantar o Script

1. Clique em **"Implantar"** > **"Nova implantação"**
2. Clique no ícone de engrenagem e selecione **"App da Web"**
3. Configure:
   - **Descrição:** API Fidelidade (ou outro nome)
   - **Executar como:** Eu (seu email)
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **"Implantar"**
5. **COPIE A URL** que aparecer (começa com `https://script.google.com/macros/...`)

## Passo 4: Configurar o index.html

Abra o arquivo `index.html` e encontre estas linhas no início do script:

```javascript
const API_URL = 'COLE_SUA_URL_DO_APPS_SCRIPT_AQUI';
const API_TOKEN = 'emporio2024secreto';
```

Substitua:
- `COLE_SUA_URL_DO_APPS_SCRIPT_AQUI` pela URL copiada no passo anterior
- `emporio2024secreto` pelo mesmo token que você definiu no script

## Passo 5: Remover a Publicação da Planilha

Agora você pode remover a publicação pública:

1. Abra a planilha no Google Sheets
2. Vá em **Arquivo** > **Compartilhar** > **Publicar na Web**
3. Clique em **"Publicado conteúdo e configurações"**
4. Clique em **"Parar publicação"**

Pronto! Sua planilha agora está privada e só o script pode acessar.

---

## Testando

1. Abra o `index.html` no navegador
2. Abra o Console (F12)
3. Você deve ver:
   - `✅ Clientes carregados: X`
   - `✅ Pontos expirados carregados`

Se aparecer erro de token, verifique se o token no `index.html` é igual ao do script.

---

## Atualizando o Script

Se precisar atualizar o código do Apps Script:

1. Faça as alterações no script
2. Clique em **"Implantar"** > **"Gerenciar implantações"**
3. Clique no lápis (editar) na implantação ativa
4. Em "Versão", selecione **"Nova versão"**
5. Clique em **"Implantar"**

A URL permanece a mesma, não precisa alterar o `index.html`.

---

## Segurança Adicional (Opcional)

Para mais segurança, você pode:

1. **Mudar o token periodicamente**
2. **Adicionar verificação de origem** no script (só aceitar do seu domínio)
3. **Limitar requisições por IP** (mais avançado)

Exemplo de verificação de origem (adicionar no doGet):
```javascript
const origin = e.parameter.origin;
if (origin !== 'https://seusite.github.io') {
  return output.setContent(JSON.stringify({ success: false, error: 'Origem não autorizada' }));
}
```
