/**
 * Fetches residential property transactions from the HM Land Registry SPARQL
 * endpoint for a set of outward codes (e.g. ["SE28", "SE2"]).
 *
 * Returns up to 5 000 transactions from the last 5 years.
 */

export interface RawTransaction {
  price: number
  date: string
  postcode: string
  propertyType: string
}

const HMLR_SPARQL = 'https://landregistry.data.gov.uk/landregistry/query'

/** Five years ago from today, formatted as xsd:date */
function fiveYearsAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 5)
  return d.toISOString().slice(0, 10)
}

/** Build a SPARQL FILTER clause that matches any of the given outward codes */
function buildOutcodeFilter(outcodes: string[]): string {
  return outcodes
    .map((oc) => `STRSTARTS(STR(?postcode), "${oc} ")`)
    .join(' || ')
}

/**
 * Fetch residential transactions for the given outward codes.
 * Returns [] on error or timeout.
 */
export async function fetchTransactions(
  outcodes: string[],
  signal?: AbortSignal,
): Promise<RawTransaction[]> {
  if (outcodes.length === 0) return []

  const cutoff = fiveYearsAgo()
  const outcodeFilter = buildOutcodeFilter(outcodes)

  const sparql = `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?price ?date ?postcode ?propertyType WHERE {
  ?trans lrppi:pricePaid ?price ;
         lrppi:transactionDate ?date ;
         lrppi:propertyAddress/lrcommon:postcode ?postcode .
  OPTIONAL { ?trans lrppi:propertyType/rdfs:label ?propertyType }
  FILTER(${outcodeFilter})
  FILTER(?date >= "${cutoff}"^^xsd:date)
  FILTER(!BOUND(?propertyType) || ?propertyType != "Other")
}
LIMIT 5000
`.trim()

  const body = new URLSearchParams({ query: sparql, output: 'json' })

  try {
    const res = await fetch(HMLR_SPARQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal,
    })

    if (!res.ok) return []

    const data = await res.json()
    const bindings: Array<Record<string, { value: string }>> =
      data?.results?.bindings ?? []

    return bindings.map((b) => ({
      price: parseFloat(b.price?.value ?? '0'),
      date: b.date?.value ?? '',
      postcode: b.postcode?.value ?? '',
      propertyType: b.propertyType?.value ?? 'Unknown',
    }))
  } catch {
    return []
  }
}
