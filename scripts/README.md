# Project scripts

`create-client-guide.py` is retained as legitimate, self-contained STARS Connect
documentation tooling. It generates the client user guide from maintained source
content and does not require generated files to be committed. Generated PDFs and
rendered intermediates belong in the root-level ignored `output/` and `tmp/`
directories.

The generator contains no customer contact records, credentials, tokens, private
URLs or production configuration. Its output is documentation only and is not an
operational-data backup.
