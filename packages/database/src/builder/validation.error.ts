export class ValidationError {
    constructor(
      public message: string,
      public location?: string,
      public suggestion?: string
    ) {}
  }