import { dateLabel, money } from "./utils.js";
export function generateBookingConfirmationMessage(b, client, service, barber) {
  return `Olá, ${client.name}! Sua reserva ${b.code} na BRAVA: ${service.name}, ${dateLabel(b)} (Brasília), com ${barber.name}. Valor: ${money(b.priceCents)}. Chegue 5 minutos antes. Se precisar alterar, fale com a equipe.`;
}
export function generateReminderMessage(b, client, service) {
  return `Olá, ${client.name}! Lembramos do seu ${service.name} na BRAVA: ${dateLabel(b)} (Brasília). Reserva ${b.code}. Podemos contar com você?`;
}
export function generateCancellationMessage(b, client) {
  return `Olá, ${client.name}. Sua reserva ${b.code} na BRAVA, ${dateLabel(b)}, foi cancelada. Motivo: ${b.cancellationReason}. Fale com a equipe para um novo horário.`;
}
export function generateRescheduleMessage(b, client, service, barber) {
  return `Seu horário foi atualizado. ${generateBookingConfirmationMessage(b, client, service, barber)}`;
}
export function generateReviewMessage(b, client) {
  return `Olá, ${client.name}! Obrigado pela visita à BRAVA. Como foi sua experiência no atendimento ${b.code}? Sua opinião ajuda a melhorar nosso trabalho.`;
}
export function generateFollowUpMessage(client) {
  return `Olá, ${client.name}! Sentimos sua falta na BRAVA. Que tal reservar um momento para renovar seu estilo? Fale com a equipe para consultar horários.`;
}
export function whatsappLink(client, message = "") {
  if (!client.consent)
    throw new Error(
      "O cliente não autorizou mensagens. Registre o consentimento antes de abrir o WhatsApp.",
    );
  if (!/^55\d{10,11}$/.test(client.phone))
    throw new Error(
      "Atualize o telefone do cliente antes de abrir o WhatsApp.",
    );
  return `https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`;
}
