export function successResponse<T>(data: T, cache = false) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (cache) {
    headers['Cache-Control'] = 'public, max-age=300, s-maxage=300';
  }
  
  return Response.json(data, { 
    status: 200, 
    headers 
  });
}

export function errorResponse(
  message: string,
  status = 500,
  details?: any
) {
  return Response.json({
    error: message,
    ...(details && { details })
  }, { 
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export function validationError(field: string, message: string) {
  return errorResponse(`Validation error: ${message}`, 400, { field });
}

export function rateLimitError() {
  return errorResponse('Rate limit exceeded. Please try again later.', 429);
}

export function notFoundError(resource: string) {
  return errorResponse(`${resource} not found`, 404);
}