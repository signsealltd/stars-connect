export const terminology = { client: "Client", clients: "Clients", clientLower: "client", clientsLower: "clients" } as const;

/** Presentation only: never apply to stored records, payload keys or uploaded documents. */
export function clientTerminology(value: string) {
  return value.replace(/student/gi, word => word === word.toUpperCase() ? "CLIENT" : word[0] === "S" ? "Client" : "client");
}
