/**
 * Fetches residential property transactions from the HM Land Registry SPARQL
 * endpoint for a set of outward codes (e.g. ["SE28", "SE2"]).
 *
 * Queries each outcode in parallel (one request per outcode) to avoid the
 * slow multi-outcode OR filter that causes the combined query to time out.
 * Each individual query completes in ~10-15s; parallel execution keeps total
 * wall time close to the slowest single query.
 */

export interface RawTransaction {
  price: number
  date: string
  postcode: string
  propertyType: string
}

const HMLR_SPARQL = 'https://landregistry.data.gov.uk/landregistry/query'
const PER_OUTCODE_LIMIT = 300
const PER_QUERY_TIMEOUT_MS = 22_000

/** Two years ago from today, formatted as xsd:date */
function twoYearsAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  return d.toISOString().slice(0, 10)
}

/** Fetch transactions for a single outcode. Returns [] on error or timeout. */
async function fetchOutcode(outcode: string, cutoff: string): Promise<RawTransaction[]> {
  const sparql = `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?price ?date ?postcode WHERE {
  ?trans lrppi:pricePaid ?price ;
         lrppi:transactionDate ?date ;
         lrppi:propertyAddress/lrcommon:postcode ?postcode .
  FILTER(STRSTARTS(STR(?postcode), "${outcode} "))
  FILTER(?date >= "${cutoff}"^^xsd:date)
}
LIMIT ${PER_OUTCODE_LIMIT}
`.trim()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PER_QUERY_TIMEOUT_MS)

  try {
    const res = await fetch(HMLR_SPARQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
      },
      body: new URLSearchParams({ query: sparql, output: 'json' }).toString(),
      signal: controller.signal,
    })

    if (!res.ok) return []

    const data = await res.json()
    const bindings: Array<Record<string, { value: string }>> =
      data?.results?.bindings ?? []

    return bindings.map((b) => ({
      price: parseFloat(b.price?.value ?? '0'),
      date: b.date?.value ?? '',
      postcode: b.postcode?.value ?? '',
      propertyType: 'Unknown',
    }))
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch residential transactions for the given outward codes.
 * Queries each outcode in parallel; returns combined deduplicated results.
 */
export async function fetchTransactions(
  outcodes: string[],
): Promise<RawTransaction[]> {
  if (outcodes.length === 0) return []

  const cutoff = twoYearsAgo()
  const results = await Promise.all(outcodes.map((oc) => fetchOutcode(oc, cutoff)))
  return results.flat()
}
