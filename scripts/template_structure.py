#!/usr/bin/env python3

'''
Find each (probable) template below the current directory by looking
for files with names ending '.html' below a directory named 'templates'
and display them in a graph showing their relationship (if any) with
their parent. Output to a file 'template_structure.pdf'
'''

import os
import re
from graphviz import Digraph

graph_attrs = {'rankdir': 'LR'}
node_attrs = {'shape': 'box'}
graph = Digraph(graph_attr=graph_attrs, node_attr=node_attrs)

for root, dirs, files in os.walk('.'):

    for file in files:
        path = os.path.join(root, file)
        match = re.fullmatch(r'.*/templates/(.*\.html)', path)

        if match:
            template = match[1]
            graph.node(template)

            with open(path, "r") as filehandle:
                text = filehandle.read()

                match = re.search('{% *extends [\'"](.*)[\'"] *%}', text)
                if match:
                    base = match[1]
                    graph.edge(base, template)

print(graph.render('template_structure'))
