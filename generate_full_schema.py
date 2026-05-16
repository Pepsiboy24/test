import json
import os

with open('/home/pepsi/.gemini/antigravity/brain/3495f2c5-4dc8-49f4-985e-16fff125908b/.system_generated/steps/380/output.txt', 'r') as f:
    data = json.load(f)

tables = data['tables']

# Group tables by schema
schemas = {}
for table in tables:
    name_parts = table['name'].split('.')
    schema_name = name_parts[0] if len(name_parts) > 1 else 'public'
    if schema_name not in schemas:
        schemas[schema_name] = []
    schemas[schema_name].append(table)

md_lines = []
md_lines.append("# Supabase Database Schema")
md_lines.append("")
md_lines.append("## Table of Contents")
schema_keys = sorted(schemas.keys())
idx = 1
for sk in schema_keys:
    md_lines.append(f"- [{idx}. {sk} schema](#{idx}-{sk}-schema)")
    idx += 1
md_lines.append(f"- [{idx}. Foreign Key Relationships (Summary)](#{idx}-foreign-key-relationships-summary)")
md_lines.append(f"- [{idx+1}. AI Consumption Prompts](#{idx+1}-ai-consumption-prompts)")
md_lines.append(f"- [{idx+2}. Change Log](#{idx+2}-change-log)")
md_lines.append("")

fks = []
compact_prompts = []

idx = 1
for sk in schema_keys:
    md_lines.append(f"## {idx}. {sk} schema")
    md_lines.append("")
    
    schema_tables = sorted(schemas[sk], key=lambda x: x['name'])
    for table in schema_tables:
        name = table['name']
        rls = table.get('rls_enabled', False)
        rows = table.get('rows', 0)
        
        md_lines.append(f"### `{name}`")
        md_lines.append(f"**RLS Enabled**: `{str(rls).lower()}` | **Approx Rows**: `{rows}`")
        md_lines.append("")
        
        compact_cols = []
        for col in table.get('columns', []):
            col_name = col['name']
            col_type = col.get('format', col.get('data_type', 'unknown'))
            col_def = col.get('default_value', '')
            
            flags_list = []
            if col_name in table.get('primary_keys', []):
                flags_list.append("PK")
                
            is_fk = False
            fk_target = ""
            for fk in table.get('foreign_key_constraints', []):
                if fk['source'] == f"{name}.{col_name}":
                    is_fk = True
                    fk_target = fk['target']
                    flags_list.append(f"FK -> {fk_target}")
                    fks.append(f"{name}.{col_name} -> {fk_target}")
            
            if col_def:
                flags_list.append(f"default {col_def}")
                
            flag_str = f" ({', '.join(flags_list)})" if flags_list else ""
            md_lines.append(f"- **{col_name}**: `{col_type}`{flag_str}")
            
            compact_cols.append(f"{col_name}: {col_type}{' PK' if 'PK' in flags_list else ''}{' FK->'+fk_target if is_fk else ''}")
            
        md_lines.append("")
        
        if sk == 'public':
            table_short_name = name.split('.')[-1]
            compact_prompts.append(f'"{table_short_name}({", ".join(compact_cols)})"')

    idx += 1


md_lines.append(f"## {idx}. Foreign Key Relationships (Summary)")
for fk in set(fks):
    md_lines.append(f"- `{fk}`")
md_lines.append("")


idx += 1
md_lines.append(f"## {idx}. AI Consumption Prompts")
md_lines.append("Use the exact column names and types above when constructing SQL or building embeddings.")
md_lines.append("Primary keys: many tables use UUID primary keys (`gen_random_uuid()`); some use integer identity columns.")
md_lines.append("RLS: Many auth and storage tables have RLS enabled. When querying as end-users via Supabase client, RLS will filter rows by JWT/auth context.")
md_lines.append("Example compact prompt snippets (Public Schema):")
md_lines.append("```")
for cp in compact_prompts:
    md_lines.append(cp)
md_lines.append("```")
md_lines.append("")

idx += 1
md_lines.append(f"## {idx}. Change Log")
md_lines.append("- **2026-03-26**: Synced master schema file with latest MCP DB state (public, auth, storage, realtime schemas included).")
md_lines.append("")

with open('/home/pepsi/Desktop/innovatech/SUPABASE_SCHEMA.md', 'w') as f:
    f.write("\n".join(md_lines))

print("Schema generated and saved to SUPABASE_SCHEMA.md!")
