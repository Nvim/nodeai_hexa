export interface EmbeddingServicePort {
  getEmbedding(text: string): Promise<number[]>
}
