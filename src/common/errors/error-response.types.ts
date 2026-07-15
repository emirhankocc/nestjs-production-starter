export type ValidationErrorDetail = {
  field: string;
  messages: string[];
};

export type ErrorResponseBody = {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  requestId: string;
  timestamp: string;
  details?: ValidationErrorDetail[];
};
