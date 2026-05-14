# Design Handoff — Calculadora de Mistura de Farinhas
**Para:** Claude Design  
**De:** Claude (conversa de receita de pão sem glúten)  
**Data:** Maio 2026

---

## Contexto

O utilizador está a desenvolver uma receita de pão sem glúten numa máquina panificadora, baseada num pão artesanal biológico (miolo.pt). A calculadora serve para pré-calcular misturas de farinhas em grandes quantidades e estimar custos por ingrediente.

A ferramenta já funciona — o handoff é para elevar a interface de "funcional" para "memorável".

---

## O que existe agora

Widget HTML inline no Claude.ai com:
- Slider para número de pães (1–30)
- 4 cards de resumo (pães, mistura seca, custo total, custo/pão)
- Tabela com 3 secções: mistura seca / frescos / hacks opcionais
- Inputs editáveis de €/kg por linha
- Cálculo dinâmico de quantidades e custos

**Problemas actuais:**
- Estética genérica — tabela simples, cards neutros, sem personalidade
- Sem hierarquia visual clara entre as 3 secções
- As tags ("exacto ✓", "fresco", "opcional") são funcionais mas pouco expressivas
- Slider de pães não tem contexto visual (não se percebe o que muda)
- Nenhum feedback visual quando os valores mudam
- Mobile não foi considerado
- Sem agrupamento visual da mistura seca vs. ingredientes frescos — que têm lógicas de uso completamente diferentes

---

## Utilizador

Padeiro caseiro entusiasta, biológico, atento à qualidade dos ingredientes. Não é developer. Usa isto para planear compras e produção caseira. Contexto: Portugal, mercado bio, pão artesanal.

---

## Direcção de design sugerida

**Tom:** Orgânico / artesanal / editorial de cozinha  
Algo entre um caderno de receitas de alta qualidade e uma ferramenta de cozinha profissional. Não minimalista-tech. Não dashboard corporativo. Deve sentir-se como uma ferramenta feita por alguém que percebe de pão.

**O que deve ser memorável:** A separação clara entre "o que preparas em avanço" (mistura seca) e "o que adicionas na hora" (frescos) — são dois mundos diferentes na lógica do padeiro.

---

## Requisitos funcionais (não alterar)

- [ ] Slider de pães 1–30, actualização em tempo real
- [ ] Input de €/kg editável por linha sem perder o foco (bug já corrigido — usar `input/change` sem re-render da tabela)
- [ ] 3 secções fixas: Mistura Seca · Frescos · Hacks
- [ ] Cards de resumo: nº pães, total mistura seca (em kg), custo total, custo/pão
- [ ] Ingredientes com quantidades fixas por pão (não editáveis pelo utilizador)

---

## Ingredientes de referência

### Mistura seca (pré-feita)
| Ingrediente | g/pão | Nota |
|---|---|---|
| Farinha de arroz bio | 90g | — |
| Farinha de amêndoa bio | 45g | — |
| Farinha de aveia s/glúten bio | 38g | — |
| Farinha de araruta bio | 30g | — |
| Avelã moída bio | 28g | **exacto ✓** (valor declarado no rótulo) |
| Farinha de trigo sarraceno bio | 24g | **exacto ✓** (valor declarado no rótulo) |
| Sal marinho | 5g | — |

### Frescos (adicionar por pão)
| Ingrediente | g/pão | Nota |
|---|---|---|
| Massa mãe activa 100% hid. | 80g | custo zero |
| Água filtrada morna | 220ml | custo zero |
| Óleo de coco bio | 15g | — |
| Geleia de arroz bio | 12g | — |

### Hacks adicionais (opcionais)
| Ingrediente | g/pão | Nota |
|---|---|---|
| Psyllium husk | 5g | dá elasticidade; sem ele reduzir água para 160–180ml |
| Fermento seco s/glúten | 2g | segurança se a massa mãe estiver fraca |

---

## Oportunidades de design

1. **Separação visual forte** entre mistura seca (pode ser feita uma vez, dura semanas) e frescos (dia de) — talvez dois painéis ou backgrounds distintos

2. **O slider de pães** podia ter mais contexto: "para ~X semanas" ou um mini-indicador de stock estimado

3. **Os valores "exacto ✓"** merecem destaque — são os únicos com certeza científica, extraídos do rótulo do produto original. Podia haver um micro-detalhe visual que os distinga

4. **Feedback de custo** — quando o custo/pão passa de um certo threshold (ex: €2.50), poderia haver um indicador subtil

5. **Totais parciais por secção** — custo só da mistura seca vs. só dos frescos seria útil para o utilizador saber onde investir

6. **Exportar / imprimir** — o utilizador já tem um PDF do cheat sheet de receita; uma versão de lista de compras gerada a partir desta calculadora seria o passo natural

7. **Preços pré-carregados** editáveis mas com indicação "estimativa" — tornar explícito que os preços são apenas referência

---

## Contexto técnico

- Corre dentro de um iframe no Claude.ai (widget HTML)
- Sem frameworks externos necessários — HTML/CSS/JS vanilla é suficiente
- Fontes disponíveis: `var(--font-sans)`, `var(--font-serif)`, `var(--font-mono)` do sistema Claude
- CSS variables do sistema disponíveis: `--color-background-primary/secondary/tertiary`, `--color-text-primary/secondary`, `--color-border-tertiary/secondary/primary`, `--border-radius-md/lg`
- Tabler Icons disponíveis via webfont: `<i class="ti ti-NOME">`
- Sem `position: fixed` (colapsa o iframe)
- Sem `localStorage` (não suportado no sandbox)
- Largura do container: ~680px

---

## O que não mudar

- Lógica de cálculo (já está correcta e testada)
- Estrutura dos 3 grupos de ingredientes
- Comportamento dos inputs de preço (não re-renderizar tabela no `input`)
- Compatibilidade com dark mode via CSS variables

---

## Prompt sugerido para o Claude Design

> Redesenha esta calculadora de mistura de farinhas para pão artesanal sem glúten. O tom deve ser orgânico e editorial — como um caderno de receitas de alta qualidade, não um dashboard tech. A separação visual entre "mistura seca (pré-feita)" e "ingredientes frescos (por pão)" é a hierarquia mais importante. Os dois ingredientes marcados como "exacto ✓" têm um significado especial — são os únicos valores confirmados cientificamente do rótulo do produto original — e merecem um tratamento visual distinto e elegante. Mantém toda a lógica funcional existente. Corre em HTML/CSS/JS vanilla dentro de um iframe Claude.ai.
> 
> [cola aqui o código actual]
