package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"github.com/felixge/httpsnoop"
	s3 "github.com/panyam/s3gen"
)

var (
	addr = flag.String("addr", DefaultAddress(), "Address where the http server is running")
)

// Site configuration for Notations Library Documentation
var Site = s3.Site{
	// Output directory for generated static site
	OutputDir: "./dist/docs",

	// Source content directory
	ContentRoot: "./content",

	// URL path prefix (e.g., if hosting at example.com/docs/)
	PathPrefix: "/docs",

	// Template directories (searched in order)
	TemplateFolders: []string{
		"./templates",
	},

	// Static asset directories (copied to output)
	StaticFolders: []string{
		"/static/", // Root static folder
		"./static", // Docs-specific static assets
	},

	// Default base template for all pages
	DefaultBaseTemplate: s3.BaseTemplate{
		Name: "BasePage.html",
		Params: map[any]any{
			"BodyTemplateName": "Content",
		},
	},

	/*
		// Build rules (order matters - first match wins)
		BuildRules: []s3.Rule{
			// Parametric pages must come first (for tags, categories, etc.)
			&s3.ParametricPages{
				Renderers: map[string]s3.Rule{
					".md":   &s3.MDToHtml{BaseToHtmlRule: s3.BaseToHtmlRule{Extensions: []string{".md"}}},
					".mdx":  &s3.MDToHtml{BaseToHtmlRule: s3.BaseToHtmlRule{Extensions: []string{".mdx"}}},
					".html": &s3.HTMLToHtml{BaseToHtmlRule: s3.BaseToHtmlRule{Extensions: []string{".html"}}},
					".htm":  &s3.HTMLToHtml{BaseToHtmlRule: s3.BaseToHtmlRule{Extensions: []string{".htm"}}},
				},
			},

			// Markdown to HTML conversion
			&s3.MDToHtml{BaseToHtmlRule: s3.BaseToHtmlRule{Extensions: []string{".md", ".mdx"}}},

			// HTML to HTML (with templating)
			&s3.HTMLToHtml{BaseToHtmlRule: s3.BaseToHtmlRule{Extensions: []string{".htm", ".html"}}},
		},

		// Priority function for build order
		// Parametric pages -> Index pages -> Regular pages
		PriorityFunc: func(res *s3.Resource) int {
			if res.IsParametric {
				return 1000 // Highest priority
			}
			if res.IsIndex {
				return 100 // Medium priority
			}
			return 0 // Default priority
		},
	*/
}

func init() {
	// In development mode, enable live reloading
	if os.Getenv("NOTATIONS_ENV") != "production" {
		Site.Rebuild(nil)
		Site.Watch()
	}
}

func main() {
	if true {
		Site.Serve(*addr)
	} else {
		m := http.NewServeMux()
		m.Handle("/docs/", http.StripPrefix(Site.PathPrefix, &Site))

		srv := &http.Server{
			Handler: withLogger(m),
			Addr:    *addr,
			// Good practice: enforce timeouts for servers you create!
			// WriteTimeout: 15 * time.Second,
			// ReadTimeout:  15 * time.Second,
		}
		log.Printf("Serving site on %s:", *addr)
		srv.ListenAndServe()
	}
}

func DefaultAddress() string {
	gateway_addr := os.Getenv("NOTATIONS_DOCS_PORT")
	if gateway_addr != "" {
		return gateway_addr
	}
	return ":8080"
}
func withLogger(handler http.Handler) http.Handler {
	// the create a handler
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		// pass the handler to httpsnoop to get http status and latency
		m := httpsnoop.CaptureMetrics(handler, writer, request)
		// printing exracted data
		log.Printf("http[%d]-- %s -- %s\n", m.Code, m.Duration, request.URL.Path)
	})
}
