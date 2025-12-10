/**
 * GOOGLE APPS SCRIPT - API para Consulta de Fidelidade
 * Empório Tecidos
 *
 * INSTRUÇÕES DE IMPLANTAÇÃO:
 * 1. Acesse https://script.google.com/
 * 2. Clique em "Novo Projeto"
 * 3. Cole todo este código
 * 4. Salve (Ctrl+S)
 * 5. Clique em "Implantar" > "Nova implantação"
 * 6. Tipo: "App da Web"
 * 7. Executar como: "Eu"
 * 8. Quem pode acessar: "Qualquer pessoa"
 * 9. Copie a URL gerada e use no index.html
 */

// ============ CONFIGURAÇÕES ============
const SPREADSHEET_ID = '1GCqzpXk_NBxQ2bBYSZLLqtCEIsNsobzQ0dcyUCGk2DM'; // ID da planilha Google Sheets
const API_TOKEN = 'fdadfasfasgasgasgasgasgfsa'; // Token de segurança
const MAIN_SHEET_NAME = 'vencer'; // Aba com clientes e saldo a vencer
const EXPIRED_SHEET_NAME = 'vencido'; // Aba com saldos expirados

// ============ FUNÇÕES PRINCIPAIS ============

function doGet(e) {
  // Configura CORS
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // Valida token
    const token = e.parameter.token;
    if (token !== API_TOKEN) {
      return output.setContent(JSON.stringify({
        success: false,
        error: 'Token inválido'
      }));
    }

    // Verifica qual dado foi solicitado
    const action = e.parameter.action || 'customers';

    if (action === 'customers') {
      const data = getCustomersData();
      return output.setContent(JSON.stringify({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      }));
    }

    if (action === 'expired') {
      const expiredData = getExpiredData();
      return output.setContent(JSON.stringify({
        success: true,
        data: expiredData.items,
        timestamp: new Date().toISOString()
      }));
    }

    if (action === 'all') {
      const customers = getCustomersData();
      const expiredData = getExpiredData();
      return output.setContent(JSON.stringify({
        success: true,
        customers: customers,
        expired: expiredData.items,
        expiredCustomers: expiredData.customers,
        timestamp: new Date().toISOString()
      }));
    }

    return output.setContent(JSON.stringify({
      success: false,
      error: 'Ação inválida'
    }));

  } catch (error) {
    return output.setContent(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

function getCustomersData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = MAIN_SHEET_NAME ? ss.getSheetByName(MAIN_SHEET_NAME) : ss.getSheets()[0];

  if (!sheet) {
    throw new Error('Aba principal não encontrada');
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = [];

  // Mapeia colunas - Aba "vencer"
  // CPF, Nome, E-mail, Telefone, Saldo total (pts), Saldo total (R$), Primeiro vencimento (data), Primeiro vencimento (R$), Dias Exp., Loja (código), Loja (nome)
  const colMap = {
    cpf: findColumn(headers, ['cpf', 'documento']),
    nome: findColumn(headers, ['nome', 'cliente']),
    email: findColumn(headers, ['email', 'e-mail']),
    telefone: findColumn(headers, ['telefone', 'tel', 'celular']),
    saldoPts: findColumn(headers, ['saldo total (pts)', 'saldo pts', 'pontos']),
    saldoRS: findColumn(headers, ['saldo total (r$)', 'saldo r$', 'saldo', 'valor']),
    vencimento: findColumn(headers, ['primeiro vencimento (data)', 'vencimento', 'validade']),
    primeiroVencimentoRS: findColumn(headers, ['primeiro vencimento (r$)'])
  };

  // Processa linhas
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cpf = String(row[colMap.cpf] || '').replace(/\D/g, '');

    if (cpf.length >= 8) {
      // Normaliza: CPF com 11 dígitos, CNPJ com 14
      const cpfNorm = cpf.length <= 11 ? cpf.padStart(11, '0') : cpf.padStart(14, '0');
      result.push({
        cpf: cpfNorm,
        nome: row[colMap.nome] || '',
        telefone: row[colMap.telefone] || '',
        saldo: parseNumber(row[colMap.saldoRS]),
        vencimento: formatDate(row[colMap.vencimento])
      });
    }
  }

  return result;
}

function getExpiredData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(EXPIRED_SHEET_NAME);

  if (!sheet) {
    return { items: {}, customers: [] }; // Retorna vazio se aba não existe
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const items = {};
  const customersMap = {}; // Para não duplicar clientes
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Mapeia colunas - Aba "vencido"
  // CPF, Nome do cliente, Email, Telefone, Saldo Atual (pontos), Saldo Atual (R$), Ticket, Data de expiração, Expirado (pontos), Expirado (R$)
  const colMap = {
    cpf: findColumn(headers, ['cpf', 'documento']),
    nome: findColumn(headers, ['nome do cliente', 'nome', 'cliente']),
    ticket: findColumn(headers, ['ticket']),
    data: findColumn(headers, ['data de expiração', 'data', 'vencimento', 'expira']),
    valor: findColumn(headers, ['expirado (r$)', 'expirado r$', 'valor expirado'])
  };

  const ticketsProcessados = {}; // Para evitar duplicação por ticket

  // Processa linhas
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cpf = String(row[colMap.cpf] || '').replace(/\D/g, '');

    if (cpf.length >= 8) {
      // Normaliza: CPF com 11 dígitos, CNPJ com 14
      const cpfNorm = cpf.length <= 11 ? cpf.padStart(11, '0') : cpf.padStart(14, '0');
      const nome = row[colMap.nome] || '';
      const ticket = String(row[colMap.ticket] || '');
      const dataExp = parseDate(row[colMap.data]);
      const valor = parseNumber(row[colMap.valor]);

      // Guarda cliente para busca (mesmo que não tenha expirado ainda)
      if (nome && !customersMap[cpfNorm]) {
        customersMap[cpfNorm] = { cpf: cpfNorm, nome: nome };
      }

      // Só inclui nos itens expirados se data < hoje e valor > 0
      // Usa ticket para evitar duplicação
      if (dataExp && dataExp < hoje && valor > 0) {
        const ticketKey = cpfNorm + '_' + ticket;
        if (!ticketsProcessados[ticketKey]) {
          ticketsProcessados[ticketKey] = true;
          if (!items[cpfNorm]) {
            items[cpfNorm] = [];
          }
          items[cpfNorm].push({
            data: formatDate(row[colMap.data]),
            valor: valor
          });
        }
      }
    }
  }

  return {
    items: items,
    customers: Object.values(customersMap)
  };
}

// ============ FUNÇÕES AUXILIARES ============

function findColumn(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).toLowerCase().trim();
    for (const name of possibleNames) {
      if (header.includes(name.toLowerCase())) {
        return i;
      }
    }
  }
  return 0; // Default para primeira coluna
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  const str = String(value || '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

function parseDate(value) {
  if (value instanceof Date) return value;
  if (!value) return null;

  const str = String(value);
  // Formato DD/MM/YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    if (year > 1900 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  return null;
}

function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value).split(' ')[0]; // Remove hora se tiver
}

// ============ TESTE LOCAL ============
function testAPI() {
  const result = doGet({ parameter: { token: API_TOKEN, action: 'all' } });
  Logger.log(result.getContent());
}
