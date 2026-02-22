export interface Document {
  id: string
  council: string
  section: string
  sectionType: string
  pageStart: number
  text: string
  embedding: number[]
}
