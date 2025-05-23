import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Clone the response before reading it
    const clonedRes = res.clone();
    const contentType = clonedRes.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    if (isJson) {
      try {
        const errorData = await clonedRes.json();
        throw new Error(`${clonedRes.status}: ${errorData.error || errorData.message || 'API Error'}`);
      } catch (e) {
        // If JSON parsing fails, fall back to text
        const text = (await clonedRes.text()) || clonedRes.statusText;
        throw new Error(`${clonedRes.status}: ${text}`);
      }
    } else {
      // Non-JSON response
      const text = (await clonedRes.text()) || clonedRes.statusText;
      throw new Error(`${clonedRes.status}: ${text} (non-JSON response)`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Create a clone before we start reading the body
    const clonedRes = res.clone();
    
    // Check if the response was successful
    if (!res.ok) {
      // For error responses, determine content type
      const contentType = res.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      try {
        if (isJson) {
          // Try to parse as JSON first
          const errorData = await res.json();
          throw new Error(`${res.status}: ${errorData.error || errorData.message || 'API Error'}`);
        } else {
          // Fall back to text for non-JSON responses
          const text = await res.text();
          throw new Error(`${res.status}: ${text || res.statusText} (non-JSON response)`);
        }
      } catch (parseError) {
        // If JSON parsing fails or any other error occurs during error handling
        throw new Error(`${res.status}: ${res.statusText || 'API Error'}`);
      }
    }
    
    // For successful responses, check content type
    const contentType = clonedRes.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn(`Warning: Received non-JSON response from ${url} with content type: ${contentType}`);
    }
    
    // Return the original response for the caller to parse
    return clonedRes;
  } catch (error) {
    console.error(`API request error for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
