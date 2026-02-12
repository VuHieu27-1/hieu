a = [1, 4, 3, 3, 4, 4, 3, 1000]
a.sort(reverse= True)
d = {}
c = 0
for i in a:
    d[i] = d.get(i, 0) + 1
for key, value in d.items():
    if value > c:
        c = value
        d = key
print(d)
    