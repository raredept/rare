import { invalidOrderTransitionMessage } from "@/lib/order-status";

/**
 * Feedback that travels in the URL (`?error=`, `?success=`) after a Server
 * Action redirect.
 *
 * The Admin toast and the customer address page used to render that text
 * verbatim. React escapes it, so it was not XSS, but anyone could send an admin
 * or a customer a link such as `/admin/products?error=Sua conta foi bloqueada,
 * ligue para …` and it appeared as a genuine alert on the real domain.
 *
 * Now only a known code or a message the server itself produces is shown;
 * anything else becomes a generic message. That fails safe: a new message that
 * is not listed here shows generically rather than verbatim, and
 * feedback-messages.test.ts scans the actions so a missing entry is caught.
 */

// Kept as a literal so this client-bundled module does not import validators.ts,
// which pulls in server-side shipping code. A test asserts it matches.
export const ACTIVE_PRODUCT_SHIPPING_DATA_MESSAGE = "Informe peso, altura, largura e comprimento maiores que 0 para ativar o produto.";

export const PRODUCT_SLUG_TAKEN_MESSAGE = "Já existe um produto com este slug. Escolha outro slug e salve novamente.";
export const CATEGORY_SLUG_TAKEN_CODE = "category-slug-taken";

const adminErrorCodes = new Map([
  ["product-save-failed", "Não foi possível salvar o produto."],
  ["category-save-failed", "Não foi possível salvar a categoria."],
  [CATEGORY_SLUG_TAKEN_CODE, "Já existe uma categoria com este slug. Escolha outro slug e salve novamente."],
  ["banner-save-failed", "Não foi possível salvar o banner."],
  ["settings-save-failed", "Não foi possível salvar as configurações."],
  ["order-status-failed", "Não foi possível atualizar o pedido."],
]);

const adminSuccessCodes = new Map([
  ["product-created", "Produto criado com sucesso."],
  ["product-saved", "Produto salvo com sucesso."],
  ["product-hidden", "Produto ocultado."],
  ["product-visible", "Produto ativado."],
  ["product-deleted", "Produto removido."],
  ["category-created", "Categoria criada com sucesso."],
  ["category-saved", "Categoria salva com sucesso."],
  ["category-hidden", "Categoria ocultada."],
  ["category-visible", "Categoria ativada."],
  ["category-deleted", "Categoria removida."],
  ["banner-created", "Banner criado com sucesso."],
  ["banner-saved", "Banner salvo com sucesso."],
  ["banner-hidden", "Banner ocultado."],
  ["banner-visible", "Banner ativado."],
  ["banner-removed", "Banner removido."],
  ["banner-reordered", "Ordem dos banners atualizada."],
  ["settings-saved", "Configurações salvas."],
  ["password-updated", "Senha atualizada com sucesso."],
  ["order-status-saved", "Status do pedido atualizado."],
]);

/** Literal messages the Admin actions send as free text. */
export const ADMIN_SERVER_MESSAGES: ReadonlySet<string> = new Set([
  // products
  "URL de mídia inválida. Use um caminho do site ou uma URL http(s).",
  "Selecione uma subcategoria ativa.",
  "Selecione uma categoria ativa.",
  "Revise os campos obrigatórios do produto.",
  "Informe uma ordem de destaque inteira maior ou igual a 1, ou deixe em branco.",
  "Cadastre pelo menos uma variação.",
  "Revise as variações informadas.",
  "Use uma variação por linha no formato Tamanho:Estoque ou Tamanho:Estoque:SKU.",
  "Existe variação duplicada. Use cada tamanho apenas uma vez.",
  "Falha ao processar imagem enviada.",
  ACTIVE_PRODUCT_SHIPPING_DATA_MESSAGE,
  PRODUCT_SLUG_TAKEN_MESSAGE,
  // banners
  "Nao foi possivel salvar o banner.",
  "Banner nao encontrado.",
  "No login, use uma imagem estática JPG, PNG, WEBP ou AVIF.",
  "Alt text é obrigatório quando houver imagem.",
  "URL da imagem desktop inválida.",
  "URL da imagem mobile inválida.",
  "Use apenas links internos seguros da loja.",
  "Informe um link interno para usar CTA.",
  // orders
  invalidOrderTransitionMessage,
  "Pedido não encontrado.",
  "Pagamento confirmado ou em processamento. Aguarde a conciliação antes de alterar este pedido.",
  "Não foi possível atualizar o pedido agora.",
]);

/** Templated messages, matched by shape and never by prefix alone. */
const ADMIN_SERVER_MESSAGE_PATTERNS: readonly RegExp[] = [
  /^(?:Peso|Comprimento|Largura|Altura) deve ser um número inteiro entre \d{1,7} e \d{1,7} (?:g|cm)\.$/,
];

export const ADMIN_GENERIC_ERROR = "Não foi possível concluir a ação. Revise os campos e tente novamente.";

export function isKnownAdminServerMessage(text: string) {
  return ADMIN_SERVER_MESSAGES.has(text) || ADMIN_SERVER_MESSAGE_PATTERNS.some((pattern) => pattern.test(text));
}

export function resolveAdminErrorMessage(raw: string | null) {
  if (!raw) return null;
  return adminErrorCodes.get(raw) ?? (isKnownAdminServerMessage(raw) ? raw : ADMIN_GENERIC_ERROR);
}

/** An unknown success value is simply not shown: there is nothing useful to say. */
export function resolveAdminSuccessMessage(raw: string | null) {
  if (!raw) return null;
  return adminSuccessCodes.get(raw) ?? null;
}

export const CUSTOMER_ADDRESS_MESSAGES: ReadonlySet<string> = new Set(["Endereco nao encontrado.", "Revise os campos do endereco."]);
export const CUSTOMER_GENERIC_ERROR = "Não foi possível concluir a ação. Tente novamente.";

export function resolveCustomerAddressError(raw: string | null | undefined) {
  if (!raw) return null;
  return CUSTOMER_ADDRESS_MESSAGES.has(raw) ? raw : CUSTOMER_GENERIC_ERROR;
}
