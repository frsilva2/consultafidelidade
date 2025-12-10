/**
 * GOOGLE APPS SCRIPT - API para Consulta de Fidelidade
 *
 * INSTRUÇÕES DE CONFIGURAÇÃO:
 * 1. Acesse https://script.google.com/
 * 2. Clique em "Novo Projeto"
 * 3. Cole todo este código
 * 4. Substitua SPREADSHEET_ID pelo ID da sua planilha
 * 5. Substitua API_TOKEN por um token secreto de sua escolha
 * 6. Clique em "Implantar" > "Nova implantação"
 * 7. Tipo: "App da Web"
 * 8. Executar como: "Eu"
 * 9. Quem pode acessar: "Qualquer pessoa"
 * 10. Copie a URL gerada e use no index.html
 */

// ============ CONFIGURAÇÕES ============
const SPREADSHEET_ID = 'SEU_SPREADSHEET_ID_AQUI'; // ID da planilha (da URL)
const API_TOKEN = 'emporio2024secreto'; // Token de segurança (mude para algo único!)
const MAIN_SHEET_NAME = 'Página1'; // Nome da aba principal (ou deixe vazio para primeira aba)
const EXPIRED_SHEET_NAME = 'Pagina1'; // Nome da aba de expirados

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
      const data = getExpiredData();
      return output.setContent(JSON.stringify({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      }));
    }

    if (action === 'all') {
      const customers = getCustomersData();
      const expired = getExpiredData();
      return output.setContent(JSON.stringify({
        success: true,
        customers: customers,
        expired: expired,
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

  // Mapeia colunas
  const colMap = {
    cpf: findColumn(headers, ['cpf', 'documento']),
    nome: findColumn(headers, ['nome', 'cliente']),
    email: findColumn(headers, ['email', 'e-mail']),
    telefone: findColumn(headers, ['telefone', 'tel', 'celular']),
    saldoPts: findColumn(headers, ['saldo pts', 'pontos']),
    saldoRS: findColumn(headers, ['saldo r$', 'saldo', 'valor']),
    vencimento: findColumn(headers, ['vencimento', 'validade', 'expira']),
    saldoExpirado: findColumn(headers, ['vencimento r$', 'expirado', 'saldo expirado'])
  };

  // Processa linhas
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cpf = String(row[colMap.cpf] || '').replace(/\D/g, '');

    if (cpf.length >= 10) {
      result.push({
        cpf: cpf.padStart(11, '0'),
        nome: row[colMap.nome] || '',
        telefone: row[colMap.telefone] || '',
        saldo: parseNumber(row[colMap.saldoRS]),
        saldoExpirado: parseNumber(row[colMap.saldoExpirado]),
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
    return {}; // Retorna vazio se aba não existe
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = {};
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Mapeia colunas
  const colMap = {
    cpf: findColumn(headers, ['cpf', 'documento']),
    data: findColumn(headers, ['data', 'vencimento', 'expira']),
    valor: findColumn(headers, ['valor', 'saldo', 'r$', 'pontos'])
  };

  // Processa linhas
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cpf = String(row[colMap.cpf] || '').replace(/\D/g, '');

    if (cpf.length >= 10) {
      const cpfNorm = cpf.padStart(11, '0');
      const dataExp = parseDate(row[colMap.data]);
      const valor = parseNumber(row[colMap.valor]);

      // Só inclui se expirado (data < hoje) e valor > 0
      if (dataExp && dataExp < hoje && valor > 0) {
        if (!result[cpfNorm]) {
          result[cpfNorm] = [];
        }
        result[cpfNorm].push({
          data: formatDate(row[colMap.data]),
          valor: valor
        });
      }
    }
  }

  return result;
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
