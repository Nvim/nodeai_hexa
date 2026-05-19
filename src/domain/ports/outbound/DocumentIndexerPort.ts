export interface IndexResult {
  files: number
  chunks: number
}

export interface DocumentIndexerPort {
  indexDocs(): Promise<IndexResult>
}
