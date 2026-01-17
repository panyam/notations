package main

import (
	"flag"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	s3 "github.com/panyam/s3gen"
)

var (
	addr  = flag.String("addr", DefaultAddress(), "Address where the http server is running")
	build = flag.Bool("build", false, "Builds the latest site and quits instead of running a server to serve it")
)

// projectRoot is the absolute path to the docs directory
var projectRoot string

func init() {
	// Get absolute path of the current working directory (docs folder)
	var err error
	projectRoot, err = filepath.Abs(".")
	if err != nil {
		log.Fatalf("Failed to get project root: %v", err)
	}
}

// IncludeFile reads and returns the contents of a file as raw (unescaped) HTML.
// The path must be relative to the docs directory and cannot escape the project.
func IncludeFile(relativePath string) template.HTML {
	// Clean the path to prevent directory traversal
	cleanPath := filepath.Clean(relativePath)

	// Reject absolute paths or paths that try to escape
	if filepath.IsAbs(cleanPath) || strings.HasPrefix(cleanPath, "..") {
		log.Printf("IncludeFile: rejected path %q (absolute or escaping)", relativePath)
		return ""
	}

	// Build full path and verify it's within project
	fullPath := filepath.Join(projectRoot, cleanPath)
	absPath, err := filepath.Abs(fullPath)
	if err != nil || !strings.HasPrefix(absPath, projectRoot) {
		log.Printf("IncludeFile: rejected path %q (escapes project root)", relativePath)
		return ""
	}

	// Read the file
	data, err := os.ReadFile(absPath)
	if err != nil {
		// Don't log error for missing files (expected for optional files like expected.svg)
		return ""
	}

	return template.HTML(data)
}

// IncludeFileText reads and returns the contents of a file as plain text (escaped).
// Useful for displaying source code or notation input.
func IncludeFileText(relativePath string) string {
	// Clean the path to prevent directory traversal
	cleanPath := filepath.Clean(relativePath)

	// Reject absolute paths or paths that try to escape
	if filepath.IsAbs(cleanPath) || strings.HasPrefix(cleanPath, "..") {
		log.Printf("IncludeFileText: rejected path %q (absolute or escaping)", relativePath)
		return ""
	}

	// Build full path and verify it's within project
	fullPath := filepath.Join(projectRoot, cleanPath)
	absPath, err := filepath.Abs(fullPath)
	if err != nil || !strings.HasPrefix(absPath, projectRoot) {
		log.Printf("IncludeFileText: rejected path %q (escapes project root)", relativePath)
		return ""
	}

	// Read the file
	data, err := os.ReadFile(absPath)
	if err != nil {
		return ""
	}

	return string(data)
}

// Site configuration for Notations Library Documentation
var Site = &s3.Site{
	// Output directory for generated static site
	OutputDir: "./dist/docs",

	// Source content directory
	ContentRoot: "./content",

	// URL path prefix (e.g., if hosting at example.com/docs/)
	PathPrefix: "/notations",

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

	// Custom template functions
	CommonFuncMap: map[string]any{
		"includeFile":     IncludeFile,     // Include file contents as raw HTML (unescaped)
		"includeFileText": IncludeFileText, // Include file contents as text (escaped)
	},
}

func main() {
	flag.Parse()
	log.Println("Build: ", *build, reflect.TypeOf(*build))

	// In development mode, enable live reloading
	if *build || os.Getenv("NOTATIONS_DOCS_ENV") != "production" {
		Site.Rebuild(nil)
		Site.Watch()
	}

	if !*build {
		Site.Serve(*addr)
	}
}

func DefaultAddress() string {
	gateway_addr := os.Getenv("NOTATIONS_DOCS_PORT")
	if gateway_addr != "" {
		return gateway_addr
	}
	return ":8080"
}
