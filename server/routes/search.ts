import { Router, Request, Response } from "express";
import { requireAuth, getUserApiKey } from '../auth-routes';
import { isPlaceholderKey } from '../utils/env-helpers';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { userSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Database connection for user settings
const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
const client = postgres(connectionString);
const db = drizzle(client);

// Web search API endpoint with OpenAI native search as primary
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, num_results = 5 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required and must be a string' });
    }
    
    console.log('🔍 WEB SEARCH API CALLED BY AGENT:', {
      query: query,
      numResults: num_results,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown'
    });
    
    let results: any[] = [];
    let searchMethod = 'unknown';
    
    // Get user's OpenAI API key for native search
    let openaiApiKey: string | null = null;
    if (req.user?.id) {
      try {
        openaiApiKey = await getUserApiKey(req.user.id, 'openai');
      } catch (error) {
        console.log('[SEARCH API] No user OpenAI API key found');
      }
    }
    
    // Try OpenAI native web search first (primary method)
    if (openaiApiKey && !isPlaceholderKey(openaiApiKey)) {
      try {
        console.log('[SEARCH API] Using OpenAI native web search as primary method');
        
        // Get user location for geographic relevance
        let userLocation = null;
        try {
          const settingsRecords = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, req.user.id))
            .limit(1);
          
          if (settingsRecords.length > 0 && settingsRecords[0].location) {
            userLocation = settingsRecords[0].location;
          }
        } catch (settingsError) {
          console.log('[SEARCH API] Could not get user location for search context');
        }
        
        // Prepare OpenAI web search request
        const searchTools = [{
          type: "web_search_preview",
          search_context_size: "medium" // Balance quality, cost, and latency
        }];
        
        // Add user location if available
        if (userLocation) {
          try {
            // Parse location to extract components
            const locationParts = userLocation.split(',').map(part => part.trim());
            if (locationParts.length >= 2) {
              const city = locationParts[0];
              const region = locationParts[1];
              
              searchTools[0].user_location = {
                type: "approximate",
                city: city,
                region: region
              };
              
              // Try to determine country code from region
              const regionLower = region.toLowerCase();
              if (regionLower.includes('us') || regionLower.includes('usa') || regionLower.includes('united states')) {
                searchTools[0].user_location.country = "US";
              } else if (regionLower.includes('uk') || regionLower.includes('united kingdom') || regionLower.includes('england')) {
                searchTools[0].user_location.country = "GB";
              } else if (regionLower.includes('canada')) {
                searchTools[0].user_location.country = "CA";
              }
            }
          } catch (locationParseError) {
            console.log('[SEARCH API] Could not parse user location for geographic search');
          }
        }
        
        const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            tools: searchTools,
            input: query,
            tool_choice: { type: "web_search_preview" } // Force web search for lower latency
          }),
          signal: AbortSignal.timeout(15000) // 15 second timeout for OpenAI search
        });
        
        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          
          // Debug: Log the full OpenAI response structure
          console.log('[SEARCH API] OpenAI response structure:', JSON.stringify(openaiData, null, 2));
          
          // Extract search results and citations from OpenAI response
          if (openaiData.output && openaiData.output.length > 0) {
            let searchText = '';
            let citations: any[] = [];
            
            console.log(`[SEARCH API] Processing ${openaiData.output.length} output items`);
            
            // Find the message content with text and annotations
            for (const item of openaiData.output) {
              console.log(`[SEARCH API] Processing item type: ${item.type}`);
              
              if (item.type === 'message' && item.content && item.content.length > 0) {
                console.log(`[SEARCH API] Found message with ${item.content.length} content items`);
                
                const textContent = item.content.find(c => c.type === 'output_text');
                if (textContent) {
                  searchText = textContent.text || '';
                  citations = textContent.annotations || [];
                  console.log(`[SEARCH API] Extracted text length: ${searchText.length}, citations: ${citations.length}`);
                  break;
                }
              }
              
              // Also check for direct text in content array
              if (item.content && Array.isArray(item.content)) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'text' && contentItem.text) {
                    searchText = contentItem.text;
                    citations = contentItem.annotations || [];
                    console.log(`[SEARCH API] Found direct text content: ${searchText.length} chars, ${citations.length} annotations`);
                    break;
                  }
                }
              }
            }
            
            // Also check the top-level output_text field (alternative response format)
            if (!searchText && openaiData.output_text) {
              searchText = openaiData.output_text;
              console.log(`[SEARCH API] Using top-level output_text: ${searchText.length} chars`);
            }
            
            console.log(`[SEARCH API] Final extracted: text=${searchText.length} chars, citations=${citations.length}`);
            
            // Format results from citations
            if (citations.length > 0) {
              results = citations
                .filter(citation => citation.type === 'url_citation' && citation.url && citation.title)
                .slice(0, num_results)
                .map((citation, index) => ({
                  title: citation.title,
                  url: citation.url,
                  snippet: searchText.substring(citation.start_index || 0, citation.end_index || (citation.start_index || 0) + 200),
                  source: new URL(citation.url).hostname,
                  citation_index: index + 1
                }));
              
              console.log(`[SEARCH API] Formatted ${results.length} results from citations`);
            }
            
            // If we have text but no citations, create a single result with the AI response
            if (searchText.length > 50 && results.length === 0) {
              results = [{
                title: `AI Answer for "${query}"`,
                url: `https://openai.com/search`,
                snippet: searchText.length > 400 ? searchText.substring(0, 400) + '...' : searchText,
                source: 'OpenAI Web Search',
                is_ai_answer: true
              }];
              console.log(`[SEARCH API] Created AI answer result from text response`);
            }
            
            // If we got good results, add a summary at the beginning
            if (results.length > 0 && searchText.length > 100 && !results.some(r => r.is_ai_answer)) {
              results.unshift({
                title: `AI Summary for "${query}"`,
                url: `https://openai.com/search`,
                snippet: searchText.length > 300 ? searchText.substring(0, 300) + '...' : searchText,
                source: 'OpenAI Web Search',
                is_summary: true
              });
            }
            
            if (results.length > 0) {
              searchMethod = 'openai';
              console.log(`[SEARCH API] OpenAI native search returned ${results.length} results`);
            } else {
              console.log(`[SEARCH API] OpenAI native search returned 0 results - no usable content found`);
            }
          } else {
            console.log(`[SEARCH API] OpenAI response has no output array or empty output`);
          }
        } else {
          const errorText = await openaiResponse.text();
          console.error(`[SEARCH API] OpenAI web search API error: ${openaiResponse.status} ${openaiResponse.statusText} - ${errorText}`);
        }
      } catch (openaiError) {
        console.error('[SEARCH API] OpenAI native search failed:', openaiError);
      }
    }
    
    // Fallback to Brave Search if OpenAI didn't work
    if (results.length === 0) {
      let braveApiKey: string | null = null;
      
      if (req.user?.id) {
        try {
          braveApiKey = await getUserApiKey(req.user.id, 'brave');
        } catch (error) {
          console.log('[SEARCH API] No user Brave API key found');
        }
      }
      
      // Fallback to environment variable if no user key
      if (!braveApiKey) {
        braveApiKey = process.env.BRAVE_SEARCH_API_KEY || null;
      }
      
      if (braveApiKey) {
        try {
          console.log('[SEARCH API] Falling back to Brave Search');
          const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${num_results}`;
          const braveResponse = await fetch(braveUrl, {
            headers: {
              'X-Subscription-Token': braveApiKey,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(8000) // 8 second timeout
          });
          
          if (braveResponse.ok) {
            const braveData = await braveResponse.json();
            
            if (braveData.web && braveData.web.results) {
              results = braveData.web.results.slice(0, num_results).map((result: any) => ({
                title: result.title,
                url: result.url,
                snippet: result.description,
                source: new URL(result.url).hostname
              }));
              
              searchMethod = 'brave';
              console.log(`[SEARCH API] Brave Search returned ${results.length} results`);
            }
          } else {
            console.error(`[SEARCH API] Brave Search API error: ${braveResponse.status} ${braveResponse.statusText}`);
          }
        } catch (braveError) {
          console.error('[SEARCH API] Brave Search failed:', braveError);
        }
      }
    }
    
    // Final fallback to DuckDuckGo if both OpenAI and Brave failed
    if (results.length === 0) {
      try {
        console.log('[SEARCH API] Falling back to DuckDuckGo search');
        // Use DuckDuckGo Instant Answer API (free, no API key needed) with timeout
        const duckduckgoUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const ddgResponse = await fetch(duckduckgoUrl, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        const ddgData = await ddgResponse.json();
        
        // Extract results from DuckDuckGo RelatedTopics
        if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
          results = ddgData.RelatedTopics
            .filter((topic: any) => topic.FirstURL && topic.Text)
            .slice(0, num_results)
            .map((topic: any) => ({
              title: topic.Text.split(' - ')[0] || topic.Text.split('.')[0] || topic.Text.substring(0, 100),
              url: topic.FirstURL,
              snippet: topic.Text,
              source: new URL(topic.FirstURL).hostname || 'duckduckgo.com'
            }));
        }
        
        // If DuckDuckGo doesn't have enough results, try the Abstract field
        if (results.length === 0 && ddgData.Abstract) {
          results.push({
            title: ddgData.Heading || query,
            url: ddgData.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            snippet: ddgData.Abstract,
            source: ddgData.AbstractSource || 'duckduckgo.com'
          });
        }
        
        // If still no results, try the Answer field
        if (results.length === 0 && ddgData.Answer) {
          results.push({
            title: `Answer for "${query}"`,
            url: ddgData.AnswerURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            snippet: ddgData.Answer,
            source: ddgData.AnswerType || 'duckduckgo.com'
          });
        }
        
        searchMethod = 'duckduckgo';
        console.log(`[SEARCH API] DuckDuckGo returned ${results.length} results`);
        
      } catch (ddgError) {
        console.error('[SEARCH API] DuckDuckGo search failed:', ddgError);
      }
    }
    
    // If no real results, provide helpful fallback
    if (results.length === 0) {
      results = [
        {
          title: `Search for "${query}" on DuckDuckGo`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: `I wasn't able to find specific results for "${query}" through any search API, but you can search for it directly on DuckDuckGo.`,
          source: "duckduckgo.com"
        }
      ];
      searchMethod = 'fallback';
    }
    
    console.log('✅ SEARCH RESULTS RETURNED TO AGENT:', {
      query: query,
      searchMethod: searchMethod,
      resultCount: results.length,
      resultTitles: results.slice(0, 3).map(r => r.title),
      timestamp: new Date().toISOString()
    });
    
    res.json({
      query,
      results,
      search_method: searchMethod,
      timestamp: new Date().toISOString(),
      total_results: results.length
    });
    
  } catch (error: any) {
    console.error('Web search error:', error);
    res.status(500).json({ 
      error: 'Failed to perform web search', 
      details: error.message 
    });
  }
});

// Test Brave Search API endpoint
router.post("/test-brave", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's Brave API key
    let braveApiKey: string | null = null;
    
    try {
      braveApiKey = await getUserApiKey(req.user.id, 'brave');
    } catch (error) {
      return res.status(400).json({ 
        error: 'No Brave Search API key configured. Please add your API key in settings.' 
      });
    }

    if (!braveApiKey) {
      return res.status(400).json({ 
        error: 'No Brave Search API key configured. Please add your API key in settings.' 
      });
    }

    // Test the API key with a simple search
    const testQuery = 'weather forecast';
    const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(testQuery)}&count=1`;
    
    const braveResponse = await fetch(braveUrl, {
      headers: {
        'X-Subscription-Token': braveApiKey,
        'Accept': 'application/json'
      }
    });

    if (braveResponse.ok) {
      const braveData = await braveResponse.json();
      
      // Check if we got valid results
      if (braveData.web && braveData.web.results && braveData.web.results.length > 0) {
        res.json({
          status: 'working',
          message: 'Brave Search API key is working correctly',
          testQuery,
          resultCount: braveData.web.results.length
        });
      } else {
        res.json({
          status: 'error',
          message: 'Brave Search API returned no results',
          testQuery
        });
      }
    } else {
      const errorText = await braveResponse.text();
      res.status(400).json({
        status: 'error',
        message: `Brave Search API error: ${braveResponse.status} ${braveResponse.statusText}`,
        details: errorText
      });
    }

  } catch (error: any) {
    console.error('Brave Search API test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test Brave Search API',
      details: error.message
    });
  }
});

export default router;