export function normaliseMileage(value:string){return value.replace(/[^0-9]/g,"").replace(/^0+(?=\d)/,"")}
export function formatVehicleDate(value:string){return new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",day:"numeric",month:"long",year:"numeric"}).format(new Date(value))}
